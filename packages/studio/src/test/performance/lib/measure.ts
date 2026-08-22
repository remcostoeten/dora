import type { Page } from '@playwright/test'
import { NAV, PERF, SELECTORS, settle } from './app'
import type { LoafEntry } from './instrument'

/**
 * Scenario runners. Each one drives the app from inside the page and returns
 * raw samples in milliseconds; percentiles are computed by the caller so the
 * raw numbers always survive into the report.
 *
 * A run's first iteration is a warm-up (lazy chunks, first schema read) and is
 * dropped by `dropWarmup` rather than silently averaged in.
 */

type Kit = {
	frame(): Promise<void>
	settle(): Promise<void>
	waitFor(test: () => boolean, timeoutMs: number): Promise<boolean>
	click(selector: string): boolean
	text(selector: string): string
}

type PerfWindow = {
	__doraPerfKit: Kit
	__doraPerf: { commits: number[]; loaf: LoafEntry[] }
}

export type ScenarioSamples = {
	label: string
	samples: number[]
	commits: number[]
}

export function dropWarmup(samples: number[]): number[] {
	return samples.length > 1 ? samples.slice(1) : samples
}

/**
 * Data Viewer ↔ SQL Console. Both directions are reported, because they are not
 * symmetric: entering the console pays for the editor, entering the viewer pays
 * for the grid.
 */
export async function measureViewSwitch(
	page: Page,
	iterations: number
): Promise<{ toSqlConsole: ScenarioSamples; toDataViewer: ScenarioSamples }> {
	return page.evaluate(
		async function run({ iterations: count, nav, selectors }) {
			const { __doraPerfKit: kit, __doraPerf: state } = window as unknown as PerfWindow
			const toSqlConsole: number[] = []
			const toDataViewer: number[] = []
			const consoleCommits: number[] = []
			const viewerCommits: number[] = []

			for (let index = 0; index < count; index += 1) {
				let commitsBefore = state.commits.length
				let start = performance.now()
				kit.click(nav.sqlConsole)
				await kit.waitFor(() => document.querySelector(selectors.editor) !== null, 10_000)
				await kit.settle()
				toSqlConsole.push(performance.now() - start)
				consoleCommits.push(state.commits.length - commitsBefore)

				commitsBefore = state.commits.length
				start = performance.now()
				kit.click(nav.dataViewer)
				await kit.waitFor(() => document.querySelector(selectors.cell) !== null, 10_000)
				await kit.settle()
				toDataViewer.push(performance.now() - start)
				viewerCommits.push(state.commits.length - commitsBefore)
			}

			return {
				toSqlConsole: {
					label: 'view-switch → SQL Console',
					samples: toSqlConsole,
					commits: consoleCommits
				},
				toDataViewer: {
					label: 'view-switch → Data Viewer',
					samples: toDataViewer,
					commits: viewerCommits
				}
			}
		},
		{
			iterations,
			nav: {
				sqlConsole: SELECTORS.navItem(NAV.sqlConsole),
				dataViewer: SELECTORS.navItem(NAV.dataViewer)
			},
			selectors: { editor: SELECTORS.editor, cell: SELECTORS.cell }
		}
	)
}

/**
 * Alternates between two small tables whose rows are already cached. The switch
 * is complete when the first data cell shows the other table's content, which
 * is a stronger settle condition than "a grid exists".
 */
export async function measureTableSwitch(page: Page, iterations: number): Promise<ScenarioSamples> {
	// Prime both tables so the run measures a cached switch, not a first read.
	for (const table of PERF.smallTables) {
		await page.click(SELECTORS.tableItem(table))
		await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
		await settle(page)
	}

	return page.evaluate(
		async function run({ iterations: count, tables, cell }) {
			const { __doraPerfKit: kit, __doraPerf: state } = window as unknown as PerfWindow
			const samples: number[] = []
			const commits: number[] = []

			for (let index = 0; index < count; index += 1) {
				const target = tables[index % tables.length] as string
				const previous = kit.text(cell)
				const commitsBefore = state.commits.length
				const start = performance.now()
				kit.click(target)
				await kit.waitFor(() => kit.text(cell) !== previous, 10_000)
				await kit.settle()
				samples.push(performance.now() - start)
				commits.push(state.commits.length - commitsBefore)
			}

			return { label: 'cached table switch', samples, commits }
		},
		{
			iterations,
			tables: PERF.smallTables.map(function toSelector(name) {
				return SELECTORS.tableItem(name)
			}),
			cell: SELECTORS.cell
		}
	)
}

/**
 * The connection menu plays a 200 ms exit animation, and Radix keeps its
 * dismiss layer mounted for the whole of it. Re-opening the menu inside that
 * window makes the still-live layer treat the trigger press as an outside
 * interaction and dismiss the menu it just opened. A user is unlikely to click
 * that fast; a harness measuring an 8 ms interaction always does.
 *
 * This is a precondition of the scenario, not part of it — no measured span
 * covers the wait.
 */
async function waitForConnectionMenuToClose(page: Page): Promise<void> {
	await page.waitForSelector('[role="menu"]', { state: 'detached', timeout: 5_000 })
}

async function openConnectionMenu(page: Page): Promise<void> {
	await waitForConnectionMenuToClose(page)
	await page.click(SELECTORS.connectionTrigger)
}

/**
 * Alternates between two connections whose schemas have both already been read.
 * Each is visited once first, so the measured switches never include a connect.
 */
export async function measureConnectionSwitch(
	page: Page,
	iterations: number
): Promise<ScenarioSamples> {
	for (const connection of [PERF.secondaryConnection, PERF.primaryConnection]) {
		await openConnectionMenu(page)
		await page.click(SELECTORS.connectionItem(connection))
		await page.waitForSelector(SELECTORS.cell, { timeout: 60_000 })
		await settle(page)
	}

	const samples: number[] = []
	const commits: number[] = []

	for (let index = 0; index < iterations; index += 1) {
		const connection = index % 2 === 0 ? PERF.secondaryConnection : PERF.primaryConnection

		// Opening the dropdown is not part of the switch; only the selection is.
		await openConnectionMenu(page)
		await page.waitForSelector(SELECTORS.connectionItem(connection), { timeout: 10_000 })

		const result = await page.evaluate(
			async function run({ item, cell }) {
				const { __doraPerfKit: kit, __doraPerf: state } = window as unknown as PerfWindow
				const previous = kit.text(cell)
				const commitsBefore = state.commits.length
				const start = performance.now()
				kit.click(item)
				await kit.waitFor(
					() => document.querySelector(cell) !== null && kit.text(cell) !== previous,
					20_000
				)
				await kit.settle()
				return {
					duration: performance.now() - start,
					commits: state.commits.length - commitsBefore
				}
			},
			{ item: SELECTORS.connectionItem(connection), cell: SELECTORS.cell }
		)

		samples.push(result.duration)
		commits.push(result.commits)
	}

	return { label: 'connection switch (cached schema)', samples, commits }
}

export type KeystrokeResult = {
	characters: number
	commits: number
	longFrames: LoafEntry[]
}

/**
 * Types into Monaco and counts React commits in the shell across the burst.
 * The budget is zero; anything above it means shell state is mirroring editor
 * text. Typing goes through Playwright so Monaco sees real key events.
 */
export async function measureKeystrokeCommits(page: Page, text: string): Promise<KeystrokeResult> {
	await page.click(SELECTORS.navItem(NAV.sqlConsole))
	await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
	await page.click(SELECTORS.editor)
	await settle(page)

	const before = await page.evaluate(function snapshot() {
		const { __doraPerf: state } = window as unknown as PerfWindow
		return { commits: state.commits.length, loaf: state.loaf.length, at: performance.now() }
	})

	await page.keyboard.type(text, { delay: 12 })
	await settle(page)

	const after = await page.evaluate(function snapshot(from: number) {
		const { __doraPerf: state } = window as unknown as PerfWindow
		return {
			commits: state.commits.length,
			longFrames: state.loaf.filter(function inWindow(entry) {
				return entry.start >= from
			})
		}
	}, before.at)

	return {
		characters: text.length,
		commits: after.commits - before.commits,
		longFrames: after.longFrames
	}
}

/**
 * Time from selecting the 100k-row table to the first painted cell. The mock
 * adapter delays 50-150 ms artificially, so this number is a first-paint
 * measurement of the render path plus that floor, not a claim about IPC.
 */
export async function measureLargeTableFirstPaint(page: Page): Promise<number> {
	await page.click(SELECTORS.tableItem(PERF.smallTables[0]))
	await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
	await settle(page)

	return page.evaluate(
		async function run({ table, cell }) {
			const { __doraPerfKit: kit } = window as unknown as PerfWindow
			const previous = kit.text(cell)
			const start = performance.now()
			kit.click(table)
			await kit.waitFor(() => kit.text(cell) !== previous, 60_000)
			await kit.settle()
			return performance.now() - start
		},
		{ table: SELECTORS.tableItem(PERF.largeTable), cell: SELECTORS.cell }
	)
}

/** Long frames recorded since a `performance.now()` timestamp. */
export async function longFramesSince(page: Page, since: number): Promise<LoafEntry[]> {
	return page.evaluate(function read(from: number) {
		const { __doraPerf: state } = window as unknown as PerfWindow
		return state.loaf.filter(function inWindow(entry) {
			return entry.start >= from
		})
	}, since)
}

export async function pageNow(page: Page): Promise<number> {
	return page.evaluate(function now() {
		return performance.now()
	})
}
