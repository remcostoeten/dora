import { defineConfig, devices } from '@playwright/test'

const port = 3210
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
    testDir: './src/e2e',
    outputDir: './test-results',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command:
            'bun run build && bun run start -- --hostname 127.0.0.1 --port 3210',
        env: {
            NEXT_INSTANT_NAVIGATION_TEST: '1'
        },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        url: baseURL
    }
})
