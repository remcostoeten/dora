import { chromium, type Browser, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = 'http://localhost:1420'
const WIDTH = 1280
const HEIGHT = 800
const RECORDINGS_DIR = path.join(process.cwd(), 'docs/assets/recordings')
const OUTPUT_WEBM = path.join(RECORDINGS_DIR, 'drizzle-update-lsp-demo.webm')
const OUTPUT_MP4 = path.join(RECORDINGS_DIR, 'drizzle-update-lsp-demo.mp4')
const CHROMIUM_EXECUTABLE = path.join(
	process.env.HOME ?? '',
	'.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'
)

async function isServerReady(): Promise<boolean> {
	try {
		const response = await fetch(BASE_URL)
		return response.ok
	} catch {
		return false
	}
}

async function waitForServer(processRef: ChildProcess | null): Promise<void> {
	const startedAt = Date.now()
	while (Date.now() - startedAt < 30_000) {
		if (await isServerReady()) return
		if (processRef?.exitCode !== null) {
			throw new Error(`Dev server exited with code ${processRef.exitCode}`)
		}
		await new Promise(function (resolve) {
			setTimeout(resolve, 500)
		})
	}
	throw new Error('Timed out waiting for Vite dev server')
}

async function ensureDevServer(): Promise<ChildProcess | null> {
	if (await isServerReady()) return null

	const child = spawn('bun', ['run', 'dev'], {
		cwd: path.join(process.cwd(), 'apps/desktop'),
		stdio: ['ignore', 'pipe', 'pipe']
	})

	child.stdout?.on('data', function (chunk) {
		process.stdout.write(chunk)
	})
	child.stderr?.on('data', function (chunk) {
		process.stderr.write(chunk)
	})

	await waitForServer(child)
	return child
}

async function addCallout(page: Page, text: string): Promise<void> {
	await page.evaluate(function (label) {
		let node = document.querySelector<HTMLDivElement>('[data-demo-callout]')
		if (!node) {
			node = document.createElement('div')
			node.dataset.demoCallout = 'true'
			node.style.position = 'fixed'
			node.style.left = '50%'
			node.style.bottom = '28px'
			node.style.transform = 'translateX(-50%)'
			node.style.zIndex = '9999'
			node.style.padding = '10px 14px'
			node.style.borderRadius = '8px'
			node.style.border = '1px solid rgba(148, 163, 184, 0.35)'
			node.style.background = 'rgba(15, 23, 42, 0.92)'
			node.style.color = 'white'
			node.style.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
			node.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.35)'
			node.style.pointerEvents = 'none'
			document.body.appendChild(node)
		}
		node.textContent = label
	}, text)
}

async function typeSlow(page: Page, text: string, delay = 26): Promise<void> {
	await page.keyboard.insertText(text)
	await page.waitForTimeout(Math.max(120, text.length * delay))
}

async function focusEditor(page: Page): Promise<void> {
	const editor = page.locator('.monaco-editor').first()
	await editor.waitFor({ state: 'visible', timeout: 15_000 })
	await editor.click({ position: { x: 220, y: 80 } })
	await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
	await page.keyboard.press('Backspace')
}

async function convertToMp4(): Promise<void> {
	const ffmpeg = spawn(
		'ffmpeg',
		[
			'-y',
			'-i',
			OUTPUT_WEBM,
			'-vf',
			'fps=30,format=yuv420p',
			'-movflags',
			'+faststart',
			OUTPUT_MP4
		],
		{ cwd: process.cwd(), stdio: 'inherit' }
	)

	await new Promise<void>(function (resolve, reject) {
		ffmpeg.on('exit', function (code) {
			if (code === 0) resolve()
			else reject(new Error(`ffmpeg exited with code ${code}`))
		})
		ffmpeg.on('error', reject)
	})
}

async function latestVideoFile(before: Set<string>): Promise<string> {
	const files = await readdir(RECORDINGS_DIR)
	const created = files.find(function (file) {
		return !before.has(file) && file.endsWith('.webm')
	})
	if (!created) throw new Error('Playwright did not produce a video file')
	return path.join(RECORDINGS_DIR, created)
}

async function run(): Promise<void> {
	await mkdir(RECORDINGS_DIR, { recursive: true })
	const before = new Set(existsSync(RECORDINGS_DIR) ? await readdir(RECORDINGS_DIR) : [])
	const server = await ensureDevServer()

	let browser: Browser | null = null
	try {
		browser = await chromium.launch({
			headless: true,
			executablePath: existsSync(CHROMIUM_EXECUTABLE) ? CHROMIUM_EXECUTABLE : undefined
		})
		const context = await browser.newContext({
			viewport: { width: WIDTH, height: HEIGHT },
			recordVideo: {
				dir: RECORDINGS_DIR,
				size: { width: WIDTH, height: HEIGHT }
			}
		})
		await context.addInitScript(function () {
			window.localStorage.clear()
		})

		const page = await context.newPage()
		await page.goto(`${BASE_URL}/?view=sql-console&connection=demo-ecommerce-001`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: /drizzle/i }).click()
		await page.waitForTimeout(800)

		await addCallout(page, 'Drizzle LSP: start from db.update(...)')
		await focusEditor(page)
		await typeSlow(page, 'db.')
		await page.waitForTimeout(900)
		await typeSlow(page, 'update(')
		await page.waitForTimeout(1000)

		await addCallout(page, 'Schema-aware table completion')
		await typeSlow(page, 'customers')
		await page.waitForTimeout(700)
		await typeSlow(page, ')')
		await page.waitForTimeout(500)
		await typeSlow(page, '.')
		await page.waitForTimeout(900)

		await addCallout(page, 'Update chain suggests .set(...)')
		await typeSlow(page, "set({ name: 'Ada Lovelace' })")
		await page.waitForTimeout(500)
		await typeSlow(page, '.where(')
		await page.waitForTimeout(1000)

		await addCallout(page, 'Where clause uses typed table columns')
		await typeSlow(page, "eq(customers.")
		await page.waitForTimeout(1000)
		await typeSlow(page, "email, 'ada@example.com'))")
		await page.waitForTimeout(1000)

		await addCallout(page, 'Run translates the Drizzle update into SQL')
		await page.getByRole('button', { name: /run/i }).click()
		await page.waitForTimeout(2200)

		await context.close()
		const produced = await latestVideoFile(before)
		await rename(produced, OUTPUT_WEBM)
		await convertToMp4()
	} finally {
		if (browser) await browser.close().catch(function () {})
		if (server) server.kill()
	}

	console.log(`Created ${OUTPUT_MP4}`)
}

run().catch(function (error) {
	console.error(error)
	process.exit(1)
})
