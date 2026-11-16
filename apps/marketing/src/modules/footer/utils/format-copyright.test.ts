import { expect, test } from 'bun:test'
import { formatCopyright, hasYearToken } from './format-copyright'

test('replaces every year token', () => {
    expect(formatCopyright('© {year} Acme, since 2020, now {year}', 2031)).toBe('© 2031 Acme, since 2020, now 2031')
})

test('leaves text without a token alone', () => {
    expect(formatCopyright('© 2026 Acme', 2031)).toBe('© 2026 Acme')
    expect(hasYearToken('© 2026 Acme')).toBe(false)
    expect(hasYearToken('© {year} Acme')).toBe(true)
})
