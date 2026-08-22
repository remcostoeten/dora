import { expect, test } from '@playwright/test'
import {
	NAV,
	PERF,
	SELECTORS,
	bootPerfApp,
	monacoCreations,
	settle,
	trackNode,
	trackedNodeSurvives
} from './lib/app'
import { measureKeystrokeCommits } from './lib/measure'

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

	test('the connection switcher lists the generated perf fixtures', async ({ page }) => {
		await page.click(SELECTORS.connectionTrigger)
		await expect(
			page.locator(SELECTORS.connectionItem(PERF.secondaryConnection))
		).toBeVisible()
	})
})
