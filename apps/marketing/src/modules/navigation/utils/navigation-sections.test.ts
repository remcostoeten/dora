import { describe, expect, test } from 'bun:test'
import type { Folder, Node } from 'fumadocs-core/page-tree'
import type { NavigationSection } from '../types/navigation'
import { getCurrentSection, getSectionShortcuts } from './navigation-sections'

function page(url: string, external = false): Node {
    return { type: 'page', name: url, url, external }
}

const index = page('/docs/reference')
const reference: Folder = {
    type: 'folder',
    name: 'Reference',
    index: index as Folder['index'],
    children: [index, page('/docs/reference/config')]
}

const sections: NavigationSection[] = [
    { id: 'root', name: 'Get started', children: [page('/docs'), page('/docs/intro')] },
    {
        id: 'guides',
        name: 'Guides',
        children: [
            page('/docs/guides/theming'),
            { type: 'separator', name: 'Advanced' },
            reference,
            page('https://example.com', true),
            page('/docs/guides/deploy')
        ]
    }
]

describe('getCurrentSection', () => {
    test('finds the section holding the page', () => {
        expect(getCurrentSection(sections, '/docs/reference/config')).toBe(1)
    })

    test('falls back to the first section', () => {
        expect(getCurrentSection(sections, '/missing')).toBe(0)
    })
})

describe('getSectionShortcuts', () => {
    test('numbers internal pages in sidebar order, folders included', () => {
        expect([...getSectionShortcuts(sections[1])]).toEqual([
            ['/docs/guides/theming', '1'],
            ['/docs/reference', '2'],
            ['/docs/reference/config', '3'],
            ['/docs/guides/deploy', '4']
        ])
    })

    test('stops at ten pages and ends with 0', () => {
        const many = Array.from({ length: 12 }, (_, i) => page(`/docs/p${i}`))
        const shortcuts = getSectionShortcuts({ id: 'many', name: 'Many', children: many })
        expect(shortcuts.size).toBe(10)
        expect(shortcuts.get('/docs/p9')).toBe('0')
        expect(shortcuts.has('/docs/p10')).toBe(false)
    })
})
