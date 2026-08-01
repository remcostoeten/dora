import { instant } from '@next/playwright'
import { expect, test, type Locator } from '@playwright/test'

async function clickDirectly(link: Locator) {
    await link.evaluate(function clickElement(element) {
        ;(element as HTMLAnchorElement).click()
    })
}

test('feature details commit an immediate route shell', async function featureTest({ page }) {
    await page.goto('/features')
    const featureLink = page.locator('a[href="/features/multi-database"]').first()
    await expect(featureLink).toBeVisible()

    await instant(page, async function assertShell() {
        await clickDirectly(featureLink)
        await expect(page).toHaveURL('/features/multi-database')
        await expect(page.getByTestId('feature-detail-shell')).toBeVisible()
    })

    await expect(page.getByTestId('feature-detail-shell')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Loading feature')
})

test('connection guides commit an immediate route shell', async function guideTest({ page }) {
    await page.goto('/docs/connect/supabase')
    const guideLink = page.locator('a[href="/docs/connect/neon"]').first()
    await expect(guideLink).toBeVisible()

    await instant(page, async function assertShell() {
        await clickDirectly(guideLink)
        await expect(page).toHaveURL('/docs/connect/neon')
        await expect(page.getByTestId('connection-guide-shell')).toBeVisible()
    })

    await expect(page.getByTestId('connection-guide-shell')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connect Neon')
})

test('MDX documentation commits an immediate route shell', async function docsTest({ page }) {
    await page.goto('/docs/getting-started')
    const docsLink = page.locator('a[href="/docs/installation"]').first()
    await expect(docsLink).toBeVisible()

    await instant(page, async function assertShell() {
        await clickDirectly(docsLink)
        await expect(page).toHaveURL('/docs/installation')
        await expect(page.getByTestId('docs-page-shell')).toBeVisible()
    })

    await expect(page.getByTestId('docs-page-shell')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Installation')
})
