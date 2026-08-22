import { expect, test } from '@playwright/test'
import {
	NAV,
	PERF,
	SELECTORS,
	adapterCalls,
	bootPerfApp,
	monacoCreations,
	settle,
	trackNode,
	trackedNodeSurvives
} from './lib/app'
import { measureKeystrokeCommits } from './lib/measure'

type PerfKit = {
	waitFor(test: () => boolean, timeoutMs: number): Promise<boolean>
	click(selector: string): boolean
	text(selector: string): string
}

/**
 * The half of the performance contract CI can enforce.
 *
 * These assert structure, not speed: whether a view survives a switch, whether
 * typing commits React, whether Monaco is built more than once. They hold on a
 * noisy shared runner, which is exactly why the timing assertions live in
 * `timings.spec.ts` and stay local.
 *
 * Several of these are expected to FAIL today. That is the point of Track 0 —
 * the contract is written first and the tests are red until Tracks 1 and 2 make
 * them green. See docs/performance-contract.md.
 */

test.describe('render invariants @invariant', () => {
	test.beforeEach(async ({ page }) => {
		await bootPerfApp(page)
	})

	test('the Data Viewer survives a round trip to the SQL Console', async ({ page }) => {
		expect(await trackNode(page, SELECTORS.grid)).toBe(true)

		await page.click(SELECTORS.navItem(NAV.sqlConsole))
		await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
		await settle(page)

		await page.click(SELECTORS.navItem(NAV.dataViewer))
		await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
		await settle(page)

		expect(
			await trackedNodeSurvives(page),
			'the grid was torn down and rebuilt — budget 1 requires zero remounts'
		).toBe(true)
	})

	test('the SQL Console survives a round trip to the Data Viewer', async ({ page }) => {
		await page.click(SELECTORS.navItem(NAV.sqlConsole))
		await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
		await settle(page)
		expect(await trackNode(page, SELECTORS.editor)).toBe(true)

		await page.click(SELECTORS.navItem(NAV.dataViewer))
		await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
		await settle(page)

		await page.click(SELECTORS.navItem(NAV.sqlConsole))
		await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
		await settle(page)

		expect(
			await trackedNodeSurvives(page),
			'the editor was torn down and rebuilt — budget 1 requires zero remounts'
		).toBe(true)
	})

	test('Monaco is created once per session', async ({ page }) => {
		await page.click(SELECTORS.navItem(NAV.sqlConsole))
		await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
		await settle(page)
		const afterFirstEntry = await monacoCreations(page)

		for (let index = 0; index < 3; index += 1) {
			await page.click(SELECTORS.navItem(NAV.dataViewer))
			await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
			await page.click(SELECTORS.navItem(NAV.sqlConsole))
			await page.waitForSelector(SELECTORS.editor, { timeout: 30_000 })
		}
		await settle(page)
		const afterThreeRoundTrips = await monacoCreations(page)

		expect(
			afterThreeRoundTrips,
			`${afterThreeRoundTrips} Monaco roots after 3 round trips (${afterFirstEntry} after the first entry) — a new editor is built on every re-entry`
		).toBe(afterFirstEntry)
	})

	test('typing in the SQL editor commits nothing in the shell', async ({ page }) => {
		const result = await measureKeystrokeCommits(
			page,
			'SELECT country, count(*) FROM perf_events GROUP BY country'
		)

		expect(result.characters).toBeGreaterThan(20)
		expect(
			result.commits,
			`${result.commits} React commits across ${result.characters} keystrokes — budget 4 requires zero`
		).toBe(0)
	})

	test('a cached table switch paints without touching the adapter', async ({ page }) => {
		// Visit both tables so each has a snapshot, then switch back to the first
		// and watch for an adapter call before the rows change.
		for (const table of PERF.smallTables) {
			await page.click(SELECTORS.tableItem(table))
			await page.waitForSelector(SELECTORS.cell, { timeout: 30_000 })
			await settle(page)
		}

		const before = await adapterCalls(page, 'fetchTableData')
		expect(before, 'the adapter call counter is not installed').toBeGreaterThan(0)

		const paint = await page.evaluate(
			async function run({ target, cell }) {
				const kit = (window as unknown as { __doraPerfKit: PerfKit }).__doraPerfKit
				const counts = (window as unknown as { __doraAdapterCalls: Record<string, number> })
					.__doraAdapterCalls
				const previous = kit.text(cell)
				const start = counts.fetchTableData ?? 0
				kit.click(target)
				const painted = await kit.waitFor(() => kit.text(cell) !== previous, 10_000)
				return { painted, calls: (counts.fetchTableData ?? 0) - start }
			},
			{
				target: SELECTORS.tableItem(PERF.smallTables[0]),
				cell: SELECTORS.cell
			}
		)

		expect(paint.painted, 'the rows never changed — the switch did not happen').toBe(true)
		expect(
			paint.calls,
			`${paint.calls} adapter fetches before first paint — budget 2 requires zero`
		).toBe(0)
	})

	test('the connection switcher lists the generated perf fixtures', async ({ page }) => {
		await page.click(SELECTORS.connectionTrigger)
		await expect(page.locator(SELECTORS.connectionItem(PERF.secondaryConnection))).toBeVisible()
	})
})
