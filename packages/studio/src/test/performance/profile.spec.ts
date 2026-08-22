import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'
import { bootPerfApp, PERF, SELECTORS, settle } from './lib/app'

/**
 * CPU-profiles one scenario so a long frame can be attributed to functions
 * rather than guessed at. Opt-in (`PERF_PROFILE=1`) because a sampling
 * profiler slows the page and would distort the timing baseline.
 *
 * Output: `perf-artifacts/profile-<scenario>-<stamp>.cpuprofile` (open in
 * Chrome DevTools → Performance → load profile) plus a self-time table on
 * stdout aggregated by function and source location.
 */

const DIRNAME = path.dirname(fileURLToPath(import.meta.url))
const ARTIFACT_DIR = path.resolve(DIRNAME, '../../../perf-artifacts')
const SWITCHES = Number(process.env.PERF_PROFILE_SWITCHES ?? 6)

type ProfileNode = {
	id: number
	callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number }
	children?: number[]
	parent?: number
}

type Profile = {
	nodes: ProfileNode[]
	samples: number[]
	timeDeltas: number[]
	startTime: number
	endTime: number
}

type Row = { key: string; selfMs: number; totalMs: number }

function aggregate(profile: Profile): { self: Row[]; total: Row[]; wallMs: number } {
	const byId = new Map<number, ProfileNode>()
	for (const node of profile.nodes) byId.set(node.id, node)
	for (const node of profile.nodes) {
		for (const child of node.children ?? []) {
			const childNode = byId.get(child)
			if (childNode) childNode.parent = node.id
		}
	}

	function keyOf(node: ProfileNode): string {
		const frame = node.callFrame
		const file = frame.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')
		const name = frame.functionName || '(anonymous)'
		return `${name}  ${file}:${frame.lineNumber + 1}`
	}

	const self = new Map<string, number>()
	const total = new Map<string, number>()
	let wall = 0
	for (let index = 0; index < profile.samples.length; index += 1) {
		const delta = (profile.timeDeltas[index] ?? 0) / 1000
		wall += delta
		const node = byId.get(profile.samples[index] as number)
		if (!node) continue
		const key = keyOf(node)
		self.set(key, (self.get(key) ?? 0) + delta)

		const seen = new Set<string>()
		let cursor: ProfileNode | undefined = node
		while (cursor) {
			const cursorKey = keyOf(cursor)
			if (!seen.has(cursorKey)) {
				seen.add(cursorKey)
				total.set(cursorKey, (total.get(cursorKey) ?? 0) + delta)
			}
			cursor = cursor.parent === undefined ? undefined : byId.get(cursor.parent)
		}
	}

	function toRows(map: Map<string, number>, field: 'selfMs' | 'totalMs'): Row[] {
		return [...map.entries()]
			.map(function toRow([key, ms]) {
				return {
					key,
					selfMs: field === 'selfMs' ? ms : 0,
					totalMs: field === 'totalMs' ? ms : 0
				}
			})
			.sort(function byMs(a, b) {
				return b[field] - a[field]
			})
	}
	return { self: toRows(self, 'selfMs'), total: toRows(total, 'totalMs'), wallMs: wall }
}

function printTable(title: string, rows: Row[], field: 'selfMs' | 'totalMs', limit: number) {
	console.log(`\n${title}`)
	for (const row of rows.slice(0, limit)) {
		console.log(`  ${row[field].toFixed(1).padStart(8)} ms  ${row.key}`)
	}
}

test.skip(process.env.PERF_PROFILE !== '1', 'set PERF_PROFILE=1 to record a CPU profile')

test('profiles a cached table switch @profile', async ({ page }) => {
	test.setTimeout(300_000)
	await bootPerfApp(page)

	for (const table of PERF.smallTables) {
		await page.click(SELECTORS.tableItem(table))
		await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
		await settle(page)
	}

	const cdp = await page.context().newCDPSession(page)
	await cdp.send('Profiler.enable')
	await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
	await cdp.send('Profiler.start')
	await page
		.context()
		.browser()
		?.startTracing(page, {
			categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline']
		})

	const durations: number[] = []
	for (let index = 0; index < SWITCHES; index += 1) {
		const table = PERF.smallTables[index % PERF.smallTables.length] as string
		const duration = await page.evaluate(
			async function run({ item, cell }) {
				const kit = (
					window as unknown as {
						__doraPerfKit: {
							click(selector: string): boolean
							text(selector: string): string
							waitFor(test: () => boolean, timeoutMs: number): Promise<boolean>
							settle(): Promise<void>
						}
					}
				).__doraPerfKit
				const previous = kit.text(cell)
				const start = performance.now()
				kit.click(item)
				await kit.waitFor(() => kit.text(cell) !== previous, 10_000)
				await kit.settle()
				return performance.now() - start
			},
			{ item: SELECTORS.tableItem(table), cell: SELECTORS.cell }
		)
		durations.push(duration)
	}

	const { profile } = (await cdp.send('Profiler.stop')) as { profile: Profile }
	const traceBuffer = await page.context().browser()?.stopTracing()
	mkdirSync(ARTIFACT_DIR, { recursive: true })
	const stamp = new Date().toISOString().replace(/[:.]/g, '-')
	const file = path.join(ARTIFACT_DIR, `profile-cached-table-switch-${stamp}.cpuprofile`)
	writeFileSync(file, JSON.stringify(profile))

	const report = aggregate(profile)
	console.log(
		`\n[profile] ${SWITCHES} switches, durations: ${durations.map((d) => d.toFixed(0)).join(', ')} ms`
	)
	console.log(`[profile] sampled wall ${report.wallMs.toFixed(0)} ms → ${file}`)
	printTable('Self time (top 45)', report.self, 'selfMs', 45)
	printTable('Total time (top 60)', report.total, 'totalMs', 60)
	if (traceBuffer) printTraceSummary(traceBuffer)
})

type TraceEvent = { name: string; ph: string; dur?: number }

/**
 * Sums wall time per trace event name. Events nest (a `RunTask` contains the
 * `FunctionCall` that contains the `Layout` it forced), so the columns are not
 * additive; read `Layout` / `UpdateLayoutTree` / `Paint` against `FunctionCall`.
 */
function printTraceSummary(buffer: Buffer) {
	const parsed = JSON.parse(buffer.toString()) as { traceEvents?: TraceEvent[] } | TraceEvent[]
	const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? [])
	const byName = new Map<string, { ms: number; count: number }>()
	for (const event of events) {
		if (event.ph !== 'X' || !event.dur) continue
		const entry = byName.get(event.name) ?? { ms: 0, count: 0 }
		entry.ms += event.dur / 1000
		entry.count += 1
		byName.set(event.name, entry)
	}
	const rows = [...byName.entries()].sort(function byMs(a, b) {
		return b[1].ms - a[1].ms
	})
	console.log('\nTrace events by name (ms, count) — nested, not additive')
	for (const [name, { ms, count }] of rows.slice(0, 25)) {
		console.log(`  ${ms.toFixed(1).padStart(8)} ms  ${String(count).padStart(6)}  ${name}`)
	}
}
