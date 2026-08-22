import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'
import { bootPerfApp, commitCount, monacoCreations } from './lib/app'
import {
	dropWarmup,
	longFramesSince,
	measureConnectionSwitch,
	measureKeystrokeCommits,
	measureLargeTableFirstPaint,
	measureTableSwitch,
	measureViewSwitch,
	pageNow
} from './lib/measure'
import { formatMs, summarize, type Summary } from './lib/stats'

/**
 * The timing half of the contract. Local only — a shared CI runner cannot hold
 * a 16 ms P95, and a flaky perf gate gets disabled within a week.
 *
 * This spec asserts nothing about durations. It records them: raw samples plus
 * P50/P95/max, written to `perf-artifacts/`. Judgement about whether a number
 * meets its budget belongs to the person reading the report.
 */

const DIRNAME = path.dirname(fileURLToPath(import.meta.url))
const ARTIFACT_DIR = path.resolve(DIRNAME, '../../../perf-artifacts')
const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 21)

type Report = {
	recordedAt: string
	iterations: number
	scenarios: Record<string, Summary & { commits?: number[]; budget?: string }>
	invariants: Record<string, number | boolean>
	longFrames: { count: number; worstMs: number }
}

test('records the performance baseline @timing', async ({ page }) => {
	test.setTimeout(600_000)

	await bootPerfApp(page)
	const runStart = await pageNow(page)
	const scenarios: Report['scenarios'] = {}

	const viewSwitch = await measureViewSwitch(page, ITERATIONS)
	scenarios['view-switch-to-sql-console'] = {
		...summarize(dropWarmup(viewSwitch.toSqlConsole.samples)),
		commits: dropWarmup(viewSwitch.toSqlConsole.commits),
		budget: 'P95 < 16 ms'
	}
	scenarios['view-switch-to-data-viewer'] = {
		...summarize(dropWarmup(viewSwitch.toDataViewer.samples)),
		commits: dropWarmup(viewSwitch.toDataViewer.commits),
		budget: 'P95 < 16 ms'
	}

	const tableSwitch = await measureTableSwitch(page, ITERATIONS)
	scenarios['cached-table-switch'] = {
		...summarize(dropWarmup(tableSwitch.samples)),
		commits: dropWarmup(tableSwitch.commits),
		budget: 'P95 < 8 ms'
	}

	const connectionSwitch = await measureConnectionSwitch(page, ITERATIONS)
	scenarios['connection-switch'] = {
		...summarize(dropWarmup(connectionSwitch.samples)),
		commits: dropWarmup(connectionSwitch.commits),
		budget: 'P95 < 16 ms'
	}

	const firstPaint = await measureLargeTableFirstPaint(page, ITERATIONS)
	scenarios['large-table-first-paint'] = {
		...summarize(dropWarmup(firstPaint)),
		budget: 'first rows < 100 ms'
	}

	const keystroke = await measureKeystrokeCommits(
		page,
		'SELECT country, count(*) FROM perf_events GROUP BY country'
	)

	const longFrames = await longFramesSince(page, runStart)
	const report: Report = {
		recordedAt: new Date().toISOString(),
		iterations: ITERATIONS,
		scenarios,
		invariants: {
			keystrokeCommits: keystroke.commits,
			keystrokeCharacters: keystroke.characters,
			monacoCreations: await monacoCreations(page),
			totalCommits: await commitCount(page)
		},
		longFrames: {
			count: longFrames.length,
			worstMs: longFrames.reduce(function worst(peak, entry) {
				return Math.max(peak, entry.duration)
			}, 0)
		}
	}

	mkdirSync(ARTIFACT_DIR, { recursive: true })
	const stamp = report.recordedAt.replace(/[:.]/g, '-')
	const file = path.join(ARTIFACT_DIR, `${stamp}.json`)
	writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)

	console.log(`\n[perf] ${ITERATIONS} iterations, warm-up dropped\n`)
	for (const [name, summary] of Object.entries(report.scenarios)) {
		console.log(
			`  ${name.padEnd(30)} P50 ${formatMs(summary.p50).padStart(10)}` +
				`  P95 ${formatMs(summary.p95).padStart(10)}` +
				`  max ${formatMs(summary.max).padStart(10)}  [${summary.budget ?? ''}]`
		)
	}
	console.log(
		`\n  keystroke commits: ${keystroke.commits} over ${keystroke.characters} characters` +
			`\n  monaco creations:  ${report.invariants.monacoCreations}` +
			`\n  long frames:       ${report.longFrames.count} (worst ${report.longFrames.worstMs.toFixed(1)} ms)` +
			`\n\n[perf] written to ${file}\n`
	)
})
