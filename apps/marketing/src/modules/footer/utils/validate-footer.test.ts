import { expect, test } from 'bun:test'
import { footerInternalLinks, validateFooter } from './validate-footer'

const link = { label: 'Intro', href: '/docs' }

test('accepts a valid footer', () => {
    const footer = {
        columns: [{ title: 'Docs', links: [link, { label: 'Mail', href: 'mailto:a@b.co' }] }]
    }
    expect(validateFooter(footer)).toEqual([])
})

test('reports an empty footer, a duplicate title and a column without links', () => {
    expect(validateFooter({ columns: [] })).toEqual(['siteFooter: columns is empty'])
    const errors = validateFooter({
        columns: [
            { title: 'Docs', links: [link] },
            { title: 'Docs', links: [] }
        ]
    })
    expect(errors).toContain('siteFooter column "Docs": the title is used twice')
    expect(errors).toContain('siteFooter column "Docs": has no links')
})

test('reports empty fields and relative paths', () => {
    const errors = validateFooter({
        columns: [
            {
                title: 'Docs',
                links: [
                    { label: '', href: 'docs' },
                    { label: 'A', href: '' }
                ]
            }
        ]
    })
    expect(errors.length).toBe(3)
})

test('lists only site links', () => {
    const footer = {
        columns: [{ title: 'Docs', links: [link, { label: 'GH', href: 'https://github.com' }] }],
        bottom: { links: [{ label: 'Terms', href: '/docs/terms' }] }
    }
    expect(footerInternalLinks(footer)).toEqual(['/docs', '/docs/terms'])
})
