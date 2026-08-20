#!/usr/bin/env node
/**
 * Capture real /app UI as WebM + PNG poster for feature detail pages.
 *
 * Uses ?capture=1 to suppress the marketing loading splash, waits for
 * data-dora-capture-ready, runs a longer scripted tour, then trims boot
 * frames with ffmpeg.
 *
 * Prerequisites:
 *   bun run dev   (marketing app on :3000)
 *   bunx playwright install chromium
 *   ffmpeg
 *
 * Usage:
 *   bun run capture:features
 *   bun run capture:features -- schema-visualization
 */

import { mkdir, unlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'features')
const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000'
const APP = `${BASE_URL}/app`
const CAPTURE_Q = 'capture=1'
const PAUSE_MS = Number(process.env.CAPTURE_PAUSE_MS ?? 1400)
const TRIM_PAD_SEC = Number(process.env.CAPTURE_TRIM_PAD_SEC ?? 0.75)
const HOLD_AFTER_MS = Number(process.env.CAPTURE_HOLD_MS ?? 2800)
const MIN_TOUR_MS = Number(process.env.CAPTURE_MIN_TOUR_MS ?? 28000)

/** @typedef {import('playwright').Page} Page */

/**
 * @param {number} ms
 */
function pause(ms = PAUSE_MS) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms)
    })
}

const CURSOR_SCRIPT = `
    (function () {
        function install() {
            if (document.getElementById('__dora_capture_cursor')) return
            const cursor = document.createElement('div')
            cursor.id = '__dora_capture_cursor'
            cursor.style.cssText = [
                'position:fixed',
                'left:0',
                'top:0',
                'z-index:2147483647',
                'pointer-events:none',
                'width:16px',
                'height:16px',
                'margin:-8px 0 0 -8px',
                'border:2px solid rgba(255,255,255,.95)',
                'border-radius:50%',
                'background:rgba(10,10,12,.72)',
                'box-shadow:0 2px 10px rgba(0,0,0,.55)',
                'transform:translate(-40px,-40px)'
            ].join(';')
            document.documentElement.appendChild(cursor)
            window.__DORA_CAPTURE_CURSOR = { x: -40, y: -40 }
            window.addEventListener('mousemove', function (event) {
                window.__DORA_CAPTURE_CURSOR = {
                    x: event.clientX,
                    y: event.clientY
                }
                cursor.style.transform =
                    'translate(' + event.clientX + 'px,' + event.clientY + 'px)'
            }, true)
            window.addEventListener('mousedown', function (event) {
                const ring = document.createElement('div')
                ring.style.cssText = [
                    'position:fixed',
                    'z-index:2147483646',
                    'pointer-events:none',
                    'left:' + event.clientX + 'px',
                    'top:' + event.clientY + 'px',
                    'width:12px',
                    'height:12px',
                    'margin:-6px 0 0 -6px',
                    'border:2px solid rgba(255,255,255,.8)',
                    'border-radius:50%',
                    'opacity:1',
                    'transition:all .38s cubic-bezier(.16,1,.3,1)'
                ].join(';')
                document.documentElement.appendChild(ring)
                requestAnimationFrame(function () {
                    ring.style.width = '38px'
                    ring.style.height = '38px'
                    ring.style.margin = '-19px 0 0 -19px'
                    ring.style.opacity = '0'
                })
                setTimeout(function () {
                    ring.remove()
                }, 420)
            }, true)
        }
        if (document.documentElement) install()
        else document.addEventListener('DOMContentLoaded', install)
    })()
`

/**
 * Move to the center of a locator along a deterministic cubic Bézier arc.
 *
 * @param {Page} page
 * @param {import('playwright').Locator} locator
 * @param {number} [duration]
 */
async function curveTo(page, locator, duration = 420) {
    const box = await locator.boundingBox()
    if (!box) return

    const end = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    }
    const start = await page.evaluate(function () {
        const current = window.__DORA_CAPTURE_CURSOR
        if (current && current.x >= 0 && current.y >= 0) return current
        return { x: 72, y: window.innerHeight - 72 }
    })
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    const bend = Math.min(110, Math.max(28, distance * 0.16))
    const direction = end.x >= start.x ? 1 : -1
    const length = distance || 1
    const normal = {
        x: (-dy / length) * bend * direction,
        y: (dx / length) * bend * direction
    }
    const controlA = {
        x: start.x + dx * 0.32 + normal.x,
        y: start.y + dy * 0.32 + normal.y
    }
    const controlB = {
        x: start.x + dx * 0.72 + normal.x * 0.45,
        y: start.y + dy * 0.72 + normal.y * 0.45
    }
    const frames = Math.max(18, Math.round(duration / 14))

    for (let frame = 1; frame <= frames; frame++) {
        const progress = frame / frames
        const eased = 1 - Math.pow(1 - progress, 3)
        const inverse = 1 - eased
        const x =
            inverse ** 3 * start.x +
            3 * inverse ** 2 * eased * controlA.x +
            3 * inverse * eased ** 2 * controlB.x +
            eased ** 3 * end.x
        const y =
            inverse ** 3 * start.y +
            3 * inverse ** 2 * eased * controlA.y +
            3 * inverse * eased ** 2 * controlB.y +
            eased ** 3 * end.y
        await page.mouse.move(x, y)
        await pause(duration / frames)
    }
}

/**
 * @param {Page} page
 * @param {import('playwright').Locator} locator
 * @param {Parameters<import('playwright').Locator['click']>[0]} [options]
 */
async function curveClick(page, locator, options) {
    await curveTo(page, locator)
    await pause(90)
    await locator.click(options)
}

/**
 * @param {string} view
 */
function captureUrl(view, extra = '') {
    const params = new URLSearchParams(CAPTURE_Q)
    params.set('view', view)
    if (extra) {
        for (const part of extra.split('&')) {
            const [key, value] = part.split('=')
            if (key && value) params.set(key, value)
        }
    }
    return `${APP}?${params.toString()}`
}

/**
 * @param {import('playwright').BrowserContext} context
 */
async function armCaptureClock(context) {
    await context.addInitScript(function () {
        localStorage.setItem('dora_demo_notice_dismissed', 'true')
        sessionStorage.setItem('dora_demo_notice_dismissed', 'true')
        localStorage.setItem('dora_onboarding_tour_completed', '1')
        window.__DORA_CAPTURE_T0 = performance.now()
        window.__DORA_CAPTURE_READY_AT = 0
    })
    await context.addInitScript(CURSOR_SCRIPT)
    await context.addInitScript(function () {
        function scrub() {
            document.querySelector('nextjs-portal')?.remove()
            const tuner = document.querySelector(
                '[aria-label="Open brand tuner"]'
            )
            tuner?.parentElement?.remove()
        }
        const observer = new MutationObserver(scrub)
        function arm() {
            scrub()
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            })
        }
        if (document.documentElement) arm()
        else document.addEventListener('DOMContentLoaded', arm)
    })
}

/**
 * @param {Page} page
 */
async function waitForCaptureReady(page) {
    await page.waitForFunction(
        function () {
            return document.documentElement.dataset.doraCaptureReady === 'true'
        },
        undefined,
        { timeout: 60000 }
    )
    await page
        .waitForFunction(
            function () {
                const text = document.body.innerText
                return (
                    !text.includes('Loading Dora') &&
                    !text.includes('Loading Dora…')
                )
            },
            undefined,
            { timeout: 15000 }
        )
        .catch(function () {})
    await page
        .locator('[aria-label="Open brand tuner"]')
        .evaluate(function (button) {
            button.parentElement?.remove()
        })
        .catch(function () {})
    await page.evaluate(function () {
        document.querySelector('nextjs-portal')?.remove()
    })
    await pause(700)
}

/**
 * @param {Page} page
 */
async function measureBootTrim(page) {
    const bootSec = await page.evaluate(function () {
        const t0 = window.__DORA_CAPTURE_T0 ?? 0
        return Math.max(0, (performance.now() - t0) / 1000)
    })
    return bootSec + TRIM_PAD_SEC
}

/**
 * @param {Page} page
 */
async function waitForSchemaGraph(page) {
    await waitForCaptureReady(page)
    await page.locator('.sv-table-node').first().waitFor({
        state: 'visible',
        timeout: 25000
    })
    await page.waitForFunction(
        function () {
            return document.querySelectorAll('.sv-table-node').length >= 3
        },
        undefined,
        { timeout: 20000 }
    )
    await pause(500)
}

/**
 * @param {Page} page
 */
async function waitForDataGrid(page) {
    await waitForCaptureReady(page)
    await page
        .locator('[data-slot="table"] [role="row"], table tbody tr')
        .first()
        .waitFor({ state: 'visible', timeout: 25000 })
        .catch(function () {})
    await pause(500)
}

/**
 * @param {Page} page
 */
async function waitForSqlConsole(page) {
    await waitForCaptureReady(page)
    await page
        .locator('.monaco-editor, .view-lines')
        .first()
        .waitFor({ state: 'visible', timeout: 25000 })
        .catch(function () {})
    await page
        .waitForFunction(
            function () {
                const text = document.body.innerText
                return (
                    text.includes('Demo E-Commerce') ||
                    (text.includes('PostgreSQL') &&
                        !text.includes('No connection'))
                )
            },
            undefined,
            { timeout: 30000 }
        )
        .catch(function () {})
    await pause(500)
}

/**
 * @param {Page} page
 * @param {string} sql
 */
async function setSqlEditorContent(page, sql) {
    const usedHook = await page.evaluate(function (content) {
        if (typeof window.__DORA_CAPTURE_SET_SQL === 'function') {
            window.__DORA_CAPTURE_SET_SQL(content)
            return true
        }
        return false
    }, sql)

    if (!usedHook) {
        await page
            .context()
            .grantPermissions(['clipboard-read', 'clipboard-write'])
            .catch(function () {})

        const editor = page.locator('.monaco-editor').first()
        await editor.click({ timeout: 5000 })
        await pause(200)

        await page.evaluate(async function (content) {
            await navigator.clipboard.writeText(content)
        }, sql)

        await page.keyboard.press('Control+A')
        await pause(120)
        await page.keyboard.press('Control+V')
        await pause(300)
    }

    await page
        .waitForFunction(
            function (expected) {
                const monaco = window.monaco
                const editors = monaco?.editor?.getEditors?.() || []
                const value = editors[0]?.getValue?.()?.trim() || ''
                return value === expected.trim()
            },
            sql,
            { timeout: 10000 }
        )
        .catch(function () {})

    await page.evaluate(function () {
        const monaco = window.monaco
        const editors = monaco?.editor?.getEditors?.() || []
        if (editors[0]) {
            editors[0].setPosition({ lineNumber: 1, column: 1 })
            editors[0].revealLineInCenter(1)
        }
    })
    await pause(700)
}

/**
 * @param {Page} page
 * @param {string} sql
 */
async function runSqlQuery(page, sql) {
    const usedHook = await page.evaluate(function (content) {
        if (typeof window.__DORA_CAPTURE_RUN_SQL === 'function') {
            window.__DORA_CAPTURE_RUN_SQL(content)
            return true
        }
        return false
    }, sql)

    if (!usedHook) {
        await page
            .locator('.monaco-editor')
            .first()
            .click({ timeout: 3000 })
            .catch(function () {})
        await pause(150)
        await page.keyboard.press('Control+Enter')
    }
}

/**
 * @param {Page} page
 * @param {number} [timeout]
 */
/**
 * @param {Page} page
 */
async function clearQueryHistory(page) {
    await page.evaluate(function () {
        localStorage.removeItem('dora-query-history')
    })
}

/**
 * @param {Page} page
 */
async function prepareHistoryCaptureFrame(page) {
    await clearQueryHistory(page)
    await page.keyboard.press('Escape').catch(function () {})
    await pause(200)

    const snippetsToggle = page.locator('[title="Toggle snippets"]')
    if (await snippetsToggle.count()) {
        const snippetsOpen = await page
            .locator('text=SNIPPETS')
            .first()
            .isVisible()
            .catch(function () {
                return false
            })
        if (snippetsOpen) {
            await snippetsToggle.click({ timeout: 3000 }).catch(function () {})
            await pause(450)
        }
    }

    const databaseSidebar = page.getByText('Tables', { exact: true }).first()
    if (
        await databaseSidebar.isVisible().catch(function () {
            return false
        })
    ) {
        await page.keyboard.press('Control+b').catch(function () {})
        await pause(450)
        if (
            await databaseSidebar.isVisible().catch(function () {
                return false
            })
        ) {
            await page
                .locator('[title="Toggle sidebar (Ctrl+B)"]')
                .first()
                .click({
                    timeout: 3000
                })
                .catch(function () {})
            await pause(450)
        }
    }
}

/**
 * @param {Page} page
 */
async function openHistoryPanel(page) {
    const toggle = page.getByRole('button', { name: /toggle history panel/i })
    const isOpen = await page
        .getByText(/^History$/i)
        .first()
        .isVisible()
        .catch(function () {
            return false
        })

    if (!isOpen && (await toggle.count())) {
        await toggle.click({ timeout: 8000 })
        await pause(700)
    }

    await page
        .getByPlaceholder(/search history/i)
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(function () {})
}

async function waitForQueryResult(page, timeout = 15000) {
    await page
        .waitForFunction(
            function () {
                const text = document.body.innerText
                return (
                    /\d+\s+rows?/i.test(text) ||
                    /backend\s*•/i.test(text) ||
                    (/No connection selected/i.test(text) === false &&
                        document.querySelectorAll(
                            '[data-slot="table"] [role="row"], table tbody tr'
                        ).length > 1)
                )
            },
            undefined,
            { timeout }
        )
        .catch(function () {})
    await pause(900)
}

/**
 * @param {Page} page
 */
async function waitForDocker(page) {
    await waitForCaptureReady(page)
    await page
        .locator('main')
        .first()
        .waitFor({ state: 'visible', timeout: 25000 })
    await pause(600)
}

/**
 * @param {Page} page
 */
async function performSchemaTour(page) {
    async function closeDetails() {
        await page
            .getByRole('button', { name: /close details/i })
            .click({ timeout: 2000 })
            .catch(function () {})
        await page.keyboard.press('Escape').catch(function () {})
        await pause(250)
    }

    await closeDetails()

    const search = page.getByPlaceholder(/search tables or columns/i)
    if (await search.count()) {
        await curveClick(page, search)
        await search.fill('order')
        await pause(1800)
        await search.fill('')
        await pause(900)
    }

    const pane = page.locator('.react-flow__pane').first()
    const box = await pane.boundingBox()
    if (box) {
        const moves = [
            { dx: -160, dy: -70 },
            { dx: 90, dy: 50 },
            { dx: -70, dy: 30 }
        ]
        for (const move of moves) {
            const cx = box.x + box.width * 0.55
            const cy = box.y + box.height * 0.45
            await page.mouse.move(cx, cy)
            await page.mouse.down()
            await page.mouse.move(cx + move.dx, cy + move.dy, { steps: 32 })
            await pause(900)
            await page.mouse.up()
            await pause(700)
        }
    }

    const nodes = page.locator('.sv-table-node')
    const count = await nodes.count()
    const limit = Math.min(count, 5)
    for (let i = 0; i < limit; i++) {
        await closeDetails()
        await curveClick(page, nodes.nth(i)).catch(function () {})
        await pause(1500)
    }

    const zoomIn = page.locator('.react-flow__controls button').first()
    if (await zoomIn.count()) {
        await curveClick(page, zoomIn).catch(function () {})
        await pause(600)
        await zoomIn.click().catch(function () {})
        await pause(900)
    }

    await closeDetails()
    if (count > 1) {
        await curveClick(page, nodes.nth(1)).catch(function () {})
        await pause(1800)
    }
}

/**
 * @param {Page} page
 */
async function dismissOverlays(page) {
    await page.keyboard.press('Escape').catch(function () {})
    await pause(250)
}

/**
 * @param {Page} page
 */
async function openConnectionSwitcher(page) {
    const trigger = page
        .getByRole('button', {
            name: /demo e-commerce|demo blog|analytics platform|hr system|select database/i
        })
        .first()
    await trigger.click({ timeout: 8000 }).catch(function () {})
    await pause(600)
}

/**
 * @param {Page} page
 * @param {string} connectionId
 */
async function selectConnection(page, connectionId) {
    await openConnectionSwitcher(page)
    await page
        .locator(`[data-connection-id="${connectionId}"]`)
        .click({ timeout: 5000 })
        .catch(function () {})
    await pause(1600)
}

/**
 * @param {Page} page
 */
async function performConnectionTour(page) {
    await dismissOverlays(page)

    const connections = [
        'demo-ecommerce-001',
        'demo-blog-002',
        'demo-analytics-003',
        'demo-hr-004'
    ]

    for (const connectionId of connections) {
        await selectConnection(page, connectionId)
    }

    await selectConnection(page, 'demo-ecommerce-001')

    const tables = ['customers', 'orders', 'products']
    for (const table of tables) {
        await page
            .getByRole('treeitem', { name: new RegExp(table, 'i') })
            .first()
            .click({ timeout: 5000 })
            .catch(function () {})
        await pause(1400)
    }

    await page.mouse.wheel(0, 360)
    await pause(900)
    await page.mouse.wheel(0, -240)
    await pause(1200)
}

/**
 * @param {Page} page
 */
async function performHistoryTour(page) {
    await prepareHistoryCaptureFrame(page)
    await openHistoryPanel(page)

    const queries = [
        'SELECT * FROM customers LIMIT 25;',
        "SELECT * FROM orders WHERE status = 'paid' LIMIT 20;",
        'SELECT * FROM products ORDER BY price DESC LIMIT 10;',
        'SELECT COUNT(*) FROM order_items;'
    ]

    for (const sql of queries) {
        await setSqlEditorContent(page, sql)
        await runSqlQuery(page, sql)
        await waitForQueryResult(page, 10000)
        await page.keyboard.press('Escape').catch(function () {})
        await pause(350)
    }

    const items = page.locator('.group.flex.flex-col.px-3.py-2.border-b')
    await items
        .first()
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(function () {})

    const search = page.getByPlaceholder(/search history/i)
    if (await search.count()) {
        await search.click({ timeout: 3000 }).catch(function () {})
        await search.fill('customers')
        await pause(1600)
        await search.fill('')
        await pause(900)
    }

    const count = await items.count()
    for (let i = 0; i < Math.min(count, 4); i++) {
        await items
            .nth(i)
            .hover({ timeout: 3000 })
            .catch(function () {})
        await pause(900)
    }

    if (count > 1) {
        const pinTarget = items.nth(1)
        await pinTarget.hover({ timeout: 3000 }).catch(function () {})
        await pinTarget
            .getByRole('button', { name: /^pin$/i })
            .click({ timeout: 3000 })
            .catch(function () {})
        await pause(1200)
    }

    if (count > 2) {
        await items
            .nth(2)
            .click({ timeout: 4000 })
            .catch(function () {})
        await pause(1400)
        await items
            .first()
            .click({ timeout: 4000 })
            .catch(function () {})
        await pause(2200)
    }

    await page.mouse.wheel(0, 220)
    await pause(900)
    await page.mouse.wheel(0, -140)
    await pause(1200)
}

/**
 * @param {Page} page
 */
async function prepareDockerCaptureFrame(page) {
    await dismissOverlays(page)

    await page
        .getByRole('button', { name: /^all$/i })
        .click({ timeout: 3000 })
        .catch(function () {})
    await pause(400)

    const search = page.getByPlaceholder(/search containers/i)
    if (await search.count()) {
        await search.fill('')
        await pause(300)
    }

    const showAll = page.locator('#show-external')
    if (await showAll.count()) {
        const checked = await showAll.isChecked().catch(function () {
            return true
        })
        if (!checked) {
            await showAll.click({ timeout: 3000 }).catch(function () {})
            await pause(400)
        }
    }
}

/**
 * @param {Page} page
 * @param {string} name
 */
async function selectDockerContainer(page, name) {
    const card = page
        .locator('[data-container-card="true"]')
        .filter({ hasText: name })
        .first()
    await curveClick(page, card, { timeout: 5000 }).catch(function () {})
    await pause(1500)
}

/**
 * @param {Page} page
 */
async function performDockerTour(page) {
    await prepareDockerCaptureFrame(page)

    await selectDockerContainer(page, 'analytics_db')
    await selectDockerContainer(page, 'dev_postgres')
    await selectDockerContainer(page, 'analytics_db')

    const logsTab = page.getByText(/^Logs$/i).first()
    if (await logsTab.count()) {
        await curveClick(page, logsTab).catch(function () {})
        await pause(1400)
        await page.mouse.wheel(0, 180)
        await pause(900)
    }

    const terminalTab = page.getByText(/^Terminal$/i).first()
    if (await terminalTab.count()) {
        await terminalTab.click().catch(function () {})
        await pause(1600)
    }

    await selectDockerContainer(page, 'analytics_db')
    await pause(1200)
}

/**
 * @param {Page} page
 */
async function performGridTour(page) {
    const grid = page
        .locator('[data-slot="table"], table, [role="grid"]')
        .first()
    await grid.hover({ timeout: 5000 }).catch(function () {})

    for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 320)
        await pause(900)
    }

    const headers = page.locator(
        '[data-slot="table"] [role="columnheader"] button, th button'
    )
    const headerCount = await headers.count()
    if (headerCount > 0) {
        await headers
            .nth(0)
            .click()
            .catch(function () {})
        await pause(1200)
        if (headerCount > 1) {
            await headers
                .nth(1)
                .click()
                .catch(function () {})
            await pause(1200)
        }
    }

    const rows = page.locator(
        '[data-slot="table"] [role="row"], table tbody tr'
    )
    const count = await rows.count()
    for (let i = 1; i < count; i++) {
        await rows
            .nth(i)
            .click({ timeout: 4000 })
            .catch(function () {})
        await pause(1100)
    }

    await page.mouse.wheel(0, -500)
    await pause(1000)
}

/**
 * @param {Page} page
 */
async function waitForAiResponse(page, timeout = 22000) {
    await page
        .waitForFunction(
            function () {
                const text = document.body.innerText
                return (
                    text.includes('schema-aware join') ||
                    (text.includes('customers') &&
                        text.includes('JOIN') &&
                        text.includes('orders'))
                )
            },
            undefined,
            { timeout }
        )
        .catch(function () {})

    await page
        .waitForFunction(
            function () {
                return !document.body.innerText
                    .toLowerCase()
                    .includes('streaming')
            },
            undefined,
            { timeout: 10000 }
        )
        .catch(function () {})

    await pause(1400)
}

/**
 * @param {Page} page
 */
async function performAiTour(page) {
    const snippetsToggle = page.locator('[title="Toggle snippets"]')
    if (await snippetsToggle.count()) {
        const snippetsOpen = await page
            .locator('text=SNIPPETS')
            .first()
            .isVisible()
            .catch(function () {
                return false
            })
        if (snippetsOpen) {
            await snippetsToggle.click({ timeout: 3000 }).catch(function () {})
            await pause(400)
        }
    }

    await curveClick(
        page,
        page.getByRole('button', { name: /open ai assistant/i }),
        { timeout: 8000, force: true }
    )
    await pause(1000)

    const suggestion = page
        .getByRole('button', {
            name: /write a join between customers and products/i
        })
        .first()
    if (await suggestion.count()) {
        await curveClick(page, suggestion, { timeout: 5000 }).catch(
            function () {}
        )
        await pause(500)
    } else {
        const prompt = page.getByPlaceholder(
            /ask anything about your database/i
        )
        await prompt.click({ timeout: 5000 }).catch(function () {})
        await prompt.fill(
            'Write a JOIN between customers and orders to show top spenders'
        )
        await pause(400)
    }

    const prompt = page.getByPlaceholder(/ask anything about your database/i)
    await prompt.press('Enter')
    await waitForAiResponse(page)

    const insert = page.getByTitle('Insert into editor').first()
    if (await insert.count()) {
        await curveClick(page, insert, { timeout: 5000 }).catch(function () {})
        await pause(2200)
    }
}

/**
 * @param {Page} page
 * @param {string} code
 */
async function setDrizzleEditorContent(page, code) {
    const usedHook = await page.evaluate(function (content) {
        if (typeof window.__DORA_CAPTURE_SET_DRIZZLE === 'function') {
            window.__DORA_CAPTURE_SET_DRIZZLE(content)
            return true
        }
        return false
    }, code)

    if (!usedHook) {
        await curveClick(
            page,
            page.getByRole('button', { name: /^drizzle$/i }),
            {
                timeout: 8000
            }
        )
        await pause(700)
        const editor = page.locator('.monaco-editor').first()
        await editor.click({ timeout: 5000 }).catch(function () {})
        await page.keyboard.press('Control+A').catch(function () {})
        await page.keyboard.press('Backspace').catch(function () {})
        await pause(300)
        await page.keyboard.type(code, { delay: 14 })
    }

    await pause(900)
}

/**
 * @param {Page} page
 * @param {string} code
 */
async function runDrizzleQuery(page, code) {
    const usedHook = await page.evaluate(function (content) {
        if (
            typeof window.__DORA_CAPTURE_SET_DRIZZLE === 'function' &&
            typeof window.__DORA_CAPTURE_RUN_DRIZZLE === 'function'
        ) {
            window.__DORA_CAPTURE_SET_DRIZZLE(content)
            window.__DORA_CAPTURE_RUN_DRIZZLE(content)
            return true
        }
        if (typeof window.__DORA_CAPTURE_RUN_DRIZZLE === 'function') {
            window.__DORA_CAPTURE_RUN_DRIZZLE(content)
            return true
        }
        return false
    }, code)

    if (!usedHook) {
        await curveClick(page, page.getByRole('button', { name: /^run$/i }), {
            timeout: 5000
        }).catch(function () {})
    }
}

/**
 * @param {Page} page
 */
async function performDrizzleTour(page) {
    const snippetsToggle = page.locator('[title="Toggle snippets"]')
    if (await snippetsToggle.count()) {
        const snippetsOpen = await page
            .locator('text=SNIPPETS')
            .first()
            .isVisible()
            .catch(function () {
                return false
            })
        if (snippetsOpen) {
            await snippetsToggle.click({ timeout: 3000 }).catch(function () {})
            await pause(400)
        }
    }

    const drizzleCode = 'db.select().from(customers).limit(25)'

    await setDrizzleEditorContent(page, drizzleCode)
    await curveTo(page, page.locator('.monaco-editor').first(), 520)
    await pause(500)
    await runDrizzleQuery(page, drizzleCode)
    await waitForQueryResult(page, 15000)
    await curveTo(
        page,
        page.getByRole('button', { name: /^run$/i }),
        460
    ).catch(function () {})
    await page.keyboard.press('Escape').catch(function () {})
    await pause(1800)
}

/**
 * @param {Page} page
 */
async function waitForSettings(page) {
    await waitForCaptureReady(page)
    await page
        .getByText('Appearance', { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 25000 })
    await pause(500)
}

/**
 * @param {Page} page
 */
async function performThemingTour(page) {
    await curveClick(
        page,
        page.getByText('Appearance', { exact: true }).first()
    ).catch(function () {})
    await pause(1400)

    const themes = [
        'Light',
        'Midnight',
        'Forest',
        'Bloom',
        'Claude Light',
        'Classic Dark'
    ]
    for (const theme of themes) {
        const card = page.getByText(theme, { exact: true }).last()
        if (await card.count()) {
            await curveClick(page, card).catch(function () {})
            await pause(2100)
        }
    }

    await page.mouse.wheel(0, 480)
    await pause(1400)
    await page.mouse.wheel(0, 420)
    await pause(1400)
    await page.mouse.wheel(0, -700)
    await pause(1200)
}

/**
 * @param {Page} page
 */
async function waitForOrmCockpit(page) {
    await waitForCaptureReady(page)
    await page
        .getByText(/tables differ/i)
        .first()
        .waitFor({ state: 'visible', timeout: 30000 })
    await pause(600)
}

/**
 * @param {Page} page
 */
async function performOrmCockpitTour(page) {
    for (const table of ['customers', 'order_items', 'reviews']) {
        await curveClick(
            page,
            page.getByText(table, { exact: true }).first()
        ).catch(function () {})
        await pause(1700)
    }

    await page.mouse.wheel(0, 360)
    await pause(1100)
    await page.mouse.wheel(0, -360)
    await pause(900)

    await curveClick(
        page,
        page.getByRole('button', { name: /generate migration/i })
    ).catch(function () {})
    await page
        .waitForFunction(
            function () {
                return !document.body.innerText.includes(
                    'No migration generated yet'
                )
            },
            undefined,
            { timeout: 20000 }
        )
        .catch(function () {})
    await pause(2400)

    await page.mouse.wheel(0, 320)
    await pause(1300)
    await page.mouse.wheel(0, 320)
    await pause(1300)

    await curveClick(
        page,
        page.getByText('Converter', { exact: true }).first()
    ).catch(function () {})
    await pause(1400)

    const converterEditor = page.locator('.monaco-editor').first()
    const editorMounted = await converterEditor
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(function () {
            return true
        })
        .catch(function () {
            return false
        })
    const editorFocused =
        editorMounted &&
        (await (async function () {
            await curveClick(page, converterEditor).catch(function () {})
            await page
                .locator('.monaco-editor textarea')
                .first()
                .focus()
                .catch(function () {})
            await pause(300)
            return page.evaluate(function () {
                return (
                    document.activeElement?.classList.contains('inputarea') ??
                    false
                )
            })
        })())
    if (editorFocused) {
        await pause(400)
        await page.keyboard.type(
            "export const reviews = pgTable('reviews', { id: serial('id').primaryKey(), rating: integer('rating'), title: varchar('title', { length: 200 }) })",
            { delay: 18 }
        )
        await page.keyboard.press('Home').catch(function () {})
        await pause(2600)
    }

    await curveClick(
        page,
        page.getByText('Differences', { exact: true }).first()
    ).catch(function () {})
    await pause(1800)
}

/**
 * @param {Page} page
 */
async function switchToPrismaMode(page) {
    const button = page.getByRole('button', { name: /prisma/i }).first()
    if (await button.count()) {
        await curveClick(page, button).catch(function () {})
    } else {
        await page
            .locator('.monaco-editor')
            .first()
            .click()
            .catch(function () {})
        await page.keyboard.press('Alt+p').catch(function () {})
    }
    await pause(1200)
}

/**
 * @param {Page} page
 */
async function performPrismaTour(page) {
    const snippetsToggle = page.locator('[title="Toggle snippets"]')
    if (await snippetsToggle.count()) {
        const snippetsOpen = await page
            .locator('text=SNIPPETS')
            .first()
            .isVisible()
            .catch(function () {
                return false
            })
        if (snippetsOpen) {
            await snippetsToggle.click({ timeout: 3000 }).catch(function () {})
            await pause(400)
        }
    }

    await switchToPrismaMode(page)

    await page
        .waitForFunction(
            function () {
                return document.body.innerText.includes('prisma.')
            },
            undefined,
            { timeout: 15000 }
        )
        .catch(function () {})
    await pause(1400)

    const runButton = page.getByRole('button', { name: /^run/i }).first()
    await curveClick(page, runButton).catch(function () {})
    await waitForQueryResult(page, 15000)
    await pause(1600)

    const editor = page.locator('.monaco-editor').first()
    await curveClick(page, editor).catch(function () {})
    await page.keyboard.press('Control+A').catch(function () {})
    await page.keyboard.press('Backspace').catch(function () {})
    await pause(400)
    await page.keyboard.type(
        "prisma.order.findMany({ where: { status: 'delivered' }, orderBy: { total: 'desc' }, take: 15 })",
        { delay: 26 }
    )
    await page.keyboard.press('Home').catch(function () {})
    await pause(1100)
    await curveClick(page, runButton).catch(function () {})
    await waitForQueryResult(page, 15000)
    await pause(2200)
}

/**
 * @param {Page} page
 * @param {import('playwright').Locator} field
 * @param {string} value
 */
async function typeIntoField(page, field, value) {
    await curveClick(page, field).catch(function () {})
    await field.fill('').catch(function () {})
    await field.pressSequentially(value, { delay: 46 }).catch(function () {})
    await pause(500)
}

/**
 * @param {Page} page
 */
async function performSshTour(page) {
    await dismissOverlays(page)
    await openConnectionSwitcher(page)

    await curveClick(
        page,
        page.getByText('Add connection', { exact: false }).first()
    ).catch(function () {})
    await pause(1400)

    const dialog = page.locator('[role="dialog"]').first()
    await dialog.waitFor({ state: 'visible', timeout: 10000 })

    await typeIntoField(
        page,
        page.getByPlaceholder(/production database/i),
        'Staging via bastion'
    )

    const hostField = page.getByPlaceholder('localhost').first()
    if (await hostField.count()) {
        await hostField.scrollIntoViewIfNeeded().catch(function () {})
        await typeIntoField(page, hostField, 'db.internal.staging')
    }

    const sshToggle = page.locator('#ssh-tunnel')
    await sshToggle.scrollIntoViewIfNeeded().catch(function () {})
    await pause(900)
    await curveClick(page, page.locator('label[for="ssh-tunnel"]')).catch(
        function () {}
    )
    await pause(1300)

    const sshHost = page.locator('#ssh-host')
    if (await sshHost.count()) {
        await sshHost.scrollIntoViewIfNeeded().catch(function () {})
        await typeIntoField(page, sshHost, 'bastion.staging.example.com')
        await typeIntoField(page, page.locator('#ssh-username'), 'deploy')
    }

    await page
        .locator('#ssh-host-key-fingerprint')
        .scrollIntoViewIfNeeded()
        .catch(function () {})
    await pause(1600)
    await sshToggle.scrollIntoViewIfNeeded().catch(function () {})
    await pause(2200)
}

/**
 * @param {string} inputPath
 * @param {number} trimSec
 */
async function trimVideoStart(inputPath, trimSec) {
    const tempPath = inputPath.replace(/\.webm$/, '.trim.webm')
    const safeTrim = Math.max(0, trimSec).toFixed(3)

    async function runFfmpeg(args) {
        await new Promise(function (resolve, reject) {
            const proc = spawn('ffmpeg', args, { stdio: 'ignore' })
            proc.on('error', reject)
            proc.on('close', function (code) {
                if (code === 0) resolve(undefined)
                else reject(new Error(`ffmpeg exited ${code}`))
            })
        })
    }

    try {
        await runFfmpeg([
            '-y',
            '-ss',
            safeTrim,
            '-i',
            inputPath,
            '-c',
            'copy',
            '-avoid_negative_ts',
            'make_zero',
            tempPath
        ])
    } catch {
        await runFfmpeg([
            '-y',
            '-ss',
            safeTrim,
            '-i',
            inputPath,
            '-an',
            '-c:v',
            'libvpx-vp9',
            '-crf',
            '34',
            '-b:v',
            '0',
            tempPath
        ])
    }

    await unlink(inputPath)
    const { rename } = await import('node:fs/promises')
    await rename(tempPath, inputPath)
}

/** @type {Array<{ slug: string; url: string; wait: (page: Page) => Promise<void>; perform: (page: Page) => Promise<void> }>} */
const CAPTURES = [
    {
        slug: 'multi-database',
        url: captureUrl('database-studio'),
        wait: waitForDataGrid,
        perform: performConnectionTour
    },
    {
        slug: 'query-history',
        url: captureUrl('sql-console'),
        wait: waitForSqlConsole,
        perform: performHistoryTour
    },
    {
        slug: 'schema-visualization',
        url: captureUrl('schema-visualizer'),
        wait: waitForSchemaGraph,
        perform: performSchemaTour
    },
    {
        slug: 'docker-containers',
        url: captureUrl('docker'),
        wait: waitForDocker,
        perform: performDockerTour
    },
    {
        slug: 'ai-assistant',
        url: captureUrl('sql-console'),
        wait: waitForSqlConsole,
        perform: performAiTour
    },
    {
        slug: 'drizzle-runner',
        url: captureUrl('sql-console'),
        wait: waitForSqlConsole,
        perform: performDrizzleTour
    },
    {
        slug: 'theming',
        url: captureUrl('settings'),
        wait: waitForSettings,
        perform: performThemingTour
    },
    {
        slug: 'orm-cockpit',
        url: captureUrl('orm-cockpit'),
        wait: waitForOrmCockpit,
        perform: performOrmCockpitTour
    },
    {
        slug: 'prisma-runner',
        url: captureUrl('sql-console'),
        wait: waitForSqlConsole,
        perform: performPrismaTour
    },
    {
        slug: 'ssh-tunneling',
        url: captureUrl('database-studio'),
        wait: waitForDataGrid,
        perform: performSshTour
    }
]

/**
 * @param {import('playwright').Browser} browser
 */
async function warmupBrowser(browser) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark'
    })
    const page = await context.newPage()
    await page.goto(captureUrl('database-studio'), {
        waitUntil: 'domcontentloaded'
    })
    await waitForCaptureReady(page).catch(function () {})
    await pause(1000)
    await context.close()
}

/**
 * @param {import('playwright').Browser} browser
 * @param {{ slug: string; url: string; wait: (page: Page) => Promise<void>; perform: (page: Page) => Promise<void> }} capture
 */
async function captureOne(browser, capture) {
    const pngPath = path.join(OUT_DIR, `${capture.slug}.png`)
    const webmPath = path.join(OUT_DIR, `${capture.slug}.webm`)

    const recordContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 2,
        colorScheme: 'dark',
        recordVideo: {
            dir: OUT_DIR,
            size: { width: 1280, height: 720 }
        }
    })

    await armCaptureClock(recordContext)
    const page = await recordContext.newPage()
    let bootTrimSec = TRIM_PAD_SEC

    try {
        await page.goto(capture.url, { waitUntil: 'domcontentloaded' })
        await capture.wait(page)
        bootTrimSec = await measureBootTrim(page)
        // poster must match the trimmed video's first frame — the feature page
        // shows it as the instant loading state and crossfades into playback
        await page.screenshot({ path: pngPath, fullPage: false })

        const tourStart = Date.now()
        try {
            await capture.perform(page)
        } catch (error) {
            console.warn(`  ! tour interrupted for ${capture.slug}:`, error)
        }
        const tourElapsed = Date.now() - tourStart
        if (tourElapsed < MIN_TOUR_MS) {
            await pause(MIN_TOUR_MS - tourElapsed)
        }
        await pause(HOLD_AFTER_MS)

        await page.close()
        const video = page.video()
        if (video) {
            const tempPath = await video.path()
            await video.saveAs(webmPath)
            if (tempPath && tempPath !== webmPath) {
                await unlink(tempPath).catch(function () {})
            }
            await trimVideoStart(webmPath, bootTrimSec)
            console.log(`  · trimmed ${bootTrimSec.toFixed(2)}s boot`)
        }
    } finally {
        await recordContext.close()
    }
}

async function main() {
    const filter = process.argv.slice(2)
    const targets =
        filter.length > 0
            ? CAPTURES.filter(function (item) {
                  return filter.includes(item.slug)
              })
            : CAPTURES

    if (targets.length === 0) {
        console.error(
            'No matching slugs. Available:',
            CAPTURES.map(function (c) {
                return c.slug
            }).join(', ')
        )
        process.exit(1)
    }

    await mkdir(OUT_DIR, { recursive: true })

    const browser = await chromium.launch({ headless: true })
    console.log('Warming up app bundle…')
    await warmupBrowser(browser)

    for (const capture of targets) {
        console.log(`Capturing ${capture.slug}…`)
        try {
            await captureOne(browser, capture)
            console.log(`  ✓ ${capture.slug}.png`)
            console.log(`  ✓ ${capture.slug}.webm`)
        } catch (error) {
            console.error(`  ✗ ${capture.slug}:`, error)
        }
    }

    await browser.close()
    console.log('Done.')
}

main().catch(function (error) {
    console.error(error)
    process.exit(1)
})
