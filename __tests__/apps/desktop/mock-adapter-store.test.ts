import { describe, it, expect, vi, beforeEach } from 'vitest'

const STORAGE_KEY = 'dora_demo_store'

describe('mock adapter store init', () => {
	beforeEach(() => {
		localStorage.clear()
		vi.resetModules()
	})

	it('reseeds when persisted store has only empty tables', async () => {
		const { MOCK_TABLE_DATA } = await import('@/core/data-provider/mock-data/index')
		const emptyTables = Object.fromEntries(
			Object.keys(MOCK_TABLE_DATA).map((key) => [key, [] as Record<string, unknown>[]])
		)

		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ tables: emptyTables, nextId: {}, connections: [], scripts: [] })
		)

		const { createMockAdapter } = await import('@/core/data-provider/adapters/mock')
		const adapter = createMockAdapter()

		const res = await adapter.fetchTableData('demo-blog-002', 'users', 0, 50)
		expect(res.ok).toBe(true)
		if (!res.ok) return
		expect(res.data.totalCount).toBeGreaterThan(0)
		expect(res.data.rows.length).toBeGreaterThan(0)
	})

	it('loads schema-qualified table references in mock mode', async () => {
		const { createMockAdapter } = await import('@/core/data-provider/adapters/mock')
		const adapter = createMockAdapter()

		const res = await adapter.fetchTableData('demo-ecommerce-001', 'public.customers', 0, 50)

		expect(res.ok).toBe(true)
		if (!res.ok) return
		expect(res.data.columns.length).toBeGreaterThan(0)
		expect(res.data.rows.length).toBeGreaterThan(0)
		expect(res.data.columns.some((column) => column.name === 'id')).toBe(true)
	})
})
