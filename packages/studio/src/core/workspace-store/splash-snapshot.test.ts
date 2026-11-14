import type { Connection } from '@studio/features/connections/types'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openTab, putTableSnapshot, setActiveNav, setConnections, setSchema } from './actions'
import {
	buildSplashSnapshot,
	configureSplashSnapshot,
	SPLASH_STORAGE_KEY,
	type SplashColors
} from './splash-snapshot'
import { readWorkspace, resetWorkspaceStore } from './store'

const colors: SplashColors = {
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

const connection = {
	id: 'demo',
	name: 'Demo E-Commerce',
	type: 'postgres',
	host: 'localhost',
	status: 'connected',
	createdAt: 0
} as Connection

function column(name: string, dataType: string, primaryKey = false) {
	return {
		name,
		data_type: dataType,
		is_nullable: false,
		default_value: null,
		is_primary_key: primaryKey
	}
}

const schema: DatabaseSchema = {
	schemas: ['public', 'audit'],
	unique_columns: [],
	tables: [
		{
			name: 'customers',
			schema: 'public',
			columns: [column('id', 'serial', true), column('email', 'varchar(255)')],
			row_count_estimate: 50
		},
		{ name: 'orders', schema: 'public', columns: [], row_count_estimate: null },
		{ name: 'events', schema: 'audit', columns: [], row_count_estimate: 9 }
	]
}

function openCustomers(): void {
	openTab({
		connectionId: 'demo',
		tableId: 'public.customers',
		tableName: 'customers',
		label: 'customers'
	})
}

describe('buildSplashSnapshot', () => {
	beforeEach(() => {
		resetWorkspaceStore()
		setConnections([connection])
		setSchema('demo', schema)
		openCustomers()
	})

	it('describes the active connection, tables, tabs and columns', () => {
		const snapshot = buildSplashSnapshot(readWorkspace(), colors)
		expect(snapshot).toMatchObject({
			v: 1,
			view: 'database-studio',
			connection: { name: 'Demo E-Commerce', provider: 'PostgreSQL' },
			activeTable: 'customers',
			tabs: [{ label: 'customers', active: true }],
			columns: [
				{ name: 'id', type: 'serial', primaryKey: true },
				{ name: 'email', type: 'varchar(255)', primaryKey: false }
			]
		})
	})

	it('lists only the tables in the active table schema', () => {
		const snapshot = buildSplashSnapshot(readWorkspace(), colors)
		expect(snapshot?.tables).toEqual([
			{ name: 'customers', count: 50 },
			{ name: 'orders', count: null }
		])
	})

	it('prefers a table snapshot for column headers', () => {
		putTableSnapshot({
			connectionId: 'demo',
			tableId: 'public.customers',
			columns: [{ name: 'id', type: 'integer', nullable: false, primaryKey: true }],
			rows: [],
			totalCount: 0,
			visibleColumns: ['id'],
			offset: 0,
			limit: 50,
			fetchedAt: 0
		})
		const snapshot = buildSplashSnapshot(readWorkspace(), colors)
		expect(snapshot?.columns).toEqual([{ name: 'id', type: 'integer', primaryKey: true }])
	})

	it('records the active view so other views fall back to the logo', () => {
		setActiveNav('sql-console')
		expect(buildSplashSnapshot(readWorkspace(), colors)?.view).toBe('sql-console')
	})

	it('returns null without an active connection', () => {
		resetWorkspaceStore()
		expect(buildSplashSnapshot(readWorkspace(), colors)).toBeNull()
	})

	it('never carries row values', () => {
		putTableSnapshot({
			connectionId: 'demo',
			tableId: 'public.customers',
			columns: [{ name: 'email', type: 'text', nullable: false, primaryKey: false }],
			rows: [{ email: 'secret@example.com' }],
			totalCount: 1,
			visibleColumns: ['email'],
			offset: 0,
			limit: 50,
			fetchedAt: 0
		})
		const serialized = JSON.stringify(buildSplashSnapshot(readWorkspace(), colors))
		expect(serialized).not.toContain('secret@example.com')
	})
})

describe('configureSplashSnapshot', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
		resetWorkspaceStore()
		setConnections([connection])
		setSchema('demo', schema)
		openCustomers()
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			color: 'rgb(17, 17, 17)'
		} as CSSStyleDeclaration)
	})

	afterEach(() => {
		configureSplashSnapshot(false)
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it('writes a payload once enabled and removes it when disabled', () => {
		configureSplashSnapshot(true)
		vi.advanceTimersByTime(600)
		const stored = window.localStorage.getItem(SPLASH_STORAGE_KEY)
		expect(stored).not.toBeNull()
		expect(JSON.parse(stored ?? '{}').connection.name).toBe('Demo E-Commerce')

		configureSplashSnapshot(false)
		expect(window.localStorage.getItem(SPLASH_STORAGE_KEY)).toBeNull()
	})
})
