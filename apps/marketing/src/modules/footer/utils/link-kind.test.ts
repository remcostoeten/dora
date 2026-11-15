import { expect, test } from 'bun:test'
import { linkKind } from './link-kind'

test('http links are external and paths are internal', () => {
    expect(linkKind({ label: 'a', href: 'https://example.com' })).toBe('external')
    expect(linkKind({ label: 'a', href: '/docs' })).toBe('internal')
})

test('mailto and tel links are plain anchors', () => {
    expect(linkKind({ label: 'a', href: 'mailto:me@example.com' })).toBe('native')
    expect(linkKind({ label: 'a', href: 'tel:+31600000000' })).toBe('native')
})

test('external overrides the guess in both directions', () => {
    expect(linkKind({ label: 'a', href: '/feed.xml', external: true })).toBe('external')
    expect(linkKind({ label: 'a', href: 'https://example.com', external: false })).toBe('internal')
})
