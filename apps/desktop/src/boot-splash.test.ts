import { SPLASH_STORAGE_KEY } from '@studio/core/workspace-store'
import { beforeAll, describe, expect, it } from 'vitest'

type Splash = {
	storageKey: string
	parseSnapshot: (raw: string) => unknown
	buildMarkup: (snapshot: unknown, viewportHeight: number) => string
}

const colors = {
	background: 'rgb(17, 17, 17)',
	foreground: 'rgb(242, 242, 242)',
	card: 'rgb(20, 20, 20)',
	muted: 'rgb(48, 48, 48)',
	mutedForeground: 'rgb(140, 140, 140)',
	border: 'rgb(48, 48, 48)',
	primary: 'rgb(250, 250, 250)',
	primaryForeground: 'rgb(23, 23, 23)',
	sidebarAccent: 'rgb(31, 31, 31)',
	sidebarForeground: 'rgb(209, 209, 209)'
}

function payload(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		v: 1,
		view: 'database-studio',
		colors,
		connection: { name: 'Demo E-Commerce', provider: 'PostgreSQL', kind: 'Server' },
		tables: [
			{ name: 'customers', count: 50 },
			{ name: 'orders', count: null }
		],
		activeTable: 'customers',
		tabs: [{ label: 'customers', active: true }],
		columns: [
			{ name: 'id', type: 'serial', primaryKey: true },
			{ name: 'email', type: 'varchar(255)', primaryKey: false }
		],
		...overrides
	})
}

let splash: Splash

beforeAll(async () => {
	await import('../public/boot-splash.js')
	splash = (window as unknown as { __doraBootSplash: Splash }).__doraBootSplash
})

describe('boot splash', () => {
	it('reads the same storage key the app writes', () => {
		expect(splash.storageKey).toBe(SPLASH_STORAGE_KEY)
	})

	it('accepts a complete table view snapshot', () => {
		expect(splash.parseSnapshot(payload())).not.toBeNull()
	})

	it.each([
		['corrupt json', '{nope'],
		['another version', payload({ v: 2 })],
		['another view', payload({ view: 'sql-console' })],
		['a non-rgb color', payload({ colors: { ...colors, background: 'url(x)' } })],
		['a missing color', payload({ colors: { background: colors.background } })],
		['no connection name', payload({ connection: { name: '', provider: 'PostgreSQL' } })]
	])('rejects %s', (_label, raw) => {
		expect(splash.parseSnapshot(raw)).toBeNull()
	})

	it('renders names, counts, tabs and column headers', () => {
		const markup = splash.buildMarkup(splash.parseSnapshot(payload()), 800)
		expect(markup).toContain('Demo E-Commerce')
		expect(markup).toContain('PostgreSQL')
		expect(markup).toContain('customers')
		expect(markup).toContain('>50<')
		expect(markup).toContain('varchar(255)')
	})

	it('escapes persisted text instead of injecting markup', () => {
		const markup = splash.buildMarkup(
			splash.parseSnapshot(
				payload({
					connection: { name: '<img src=x onerror=alert(1)>', provider: 'PostgreSQL' }
				})
			),
			800
		)
		expect(markup).not.toContain('<img')
		expect(markup).toContain('&lt;img')
	})

	it('draws more skeleton rows in a taller window', () => {
		const snapshot = splash.parseSnapshot(payload())
		const rows = (html: string) => html.split('sp-row sp-in').length - 1
		expect(rows(splash.buildMarkup(snapshot, 2000))).toBeGreaterThan(
			rows(splash.buildMarkup(snapshot, 700))
		)
	})
})
