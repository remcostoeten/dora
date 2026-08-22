import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const DIRNAME = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(DIRNAME, '../../../../..')
const PORT = 1420
const BASE_URL = process.env.PERF_BASE_URL ?? `http://localhost:${PORT}`

/**
 * The performance harness runs against browser-mode Studio with the mock
 * adapter — the same target as the boot smoke, for the same reason: it removes
 * backend variance so a frontend regression cannot hide behind a slow query.
 *
 * One worker, no retries. Perf samples from parallel workers share a CPU and
 * are not comparable, and a retried timing sample is a different sample.
 */
export default defineConfig({
	testDir: DIRNAME,
	testMatch: /.*\.spec\.ts/,
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 180_000,
	expect: { timeout: 30_000 },
	reporter: process.env.CI ? [['github'], ['list']] : [['list']],
	use: {
		...devices['Desktop Chrome'],
		baseURL: BASE_URL,
		viewport: { width: 1600, height: 900 },
		trace: 'off',
		video: 'off',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: `bun vite --port ${PORT} --strictPort`,
		cwd: path.join(REPO_ROOT, 'apps', 'desktop'),
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 120_000,
		stdout: 'ignore',
		stderr: 'pipe'
	}
})
