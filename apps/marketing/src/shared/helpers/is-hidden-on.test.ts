import { expect, test } from 'bun:test'
import { isHiddenOn } from './is-hidden-on'

test('matches exact pages with or without a trailing slash', () => {
    expect(isHiddenOn('/docs/changelog', ['/docs/changelog'])).toBe(true)
    expect(isHiddenOn('/docs/changelog', ['/docs/changelog/'])).toBe(true)
    expect(isHiddenOn('/docs/changelogs', ['/docs/changelog'])).toBe(false)
})

test('* stays inside one segment and ** crosses segments', () => {
    expect(isHiddenOn('/docs/guides/theming', ['/docs/guides/*'])).toBe(true)
    expect(isHiddenOn('/docs/guides/deployment/vercel', ['/docs/guides/*'])).toBe(false)
    expect(isHiddenOn('/docs/guides/deployment/vercel', ['/docs/guides/**'])).toBe(true)
})

test('hides nothing without patterns', () => {
    expect(isHiddenOn('/docs', undefined)).toBe(false)
    expect(isHiddenOn('/docs', [])).toBe(false)
})
