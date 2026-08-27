import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { schemaQueryOptions } from '@studio/core/data-provider/schema-query'
import type { DataAdapter } from '@studio/core/data-provider/types'
import { readSchemaEntry, resetWorkspaceStore } from '@studio/core/workspace-store'
import type { DatabaseSchema } from '@studio/lib/bindings'

const SCHEMA: DatabaseSchema = {
	tables: [],
	schemas: [],
	unique_columns: []
}

function stubAdapter() {
	const connectToDatabase = vi.fn(async () => ({
		ok: true as const,
		data: { connected: true, fileSources: null }
	}))
	const getSchema = vi.fn(async () => ({ ok: true as const, data: SCHEMA }))
	return { connectToDatabase, getSchema } as unknown as DataAdapter & {
		connectToDatabase: typeof connectToDatabase
		getSchema: typeof getSchema
	}
}

describe('schemaQueryOptions', () => {
	afterEach(() => {
		resetWorkspaceStore()
	})

	it('single-flights concurrent fetches through the query client', async () => {
		const adapter = stubAdapter()
		const queryClient = new QueryClient()
		const options = schemaQueryOptions(adapter, queryClient, 'conn-1')

		const [a, b] = await Promise.all([
			queryClient.fetchQuery(options),
			queryClient.fetchQuery(options)
		])

		expect(a).toEqual(SCHEMA)
		expect(b).toEqual(SCHEMA)
		expect(adapter.connectToDatabase).toHaveBeenCalledTimes(1)
		expect(adapter.getSchema).toHaveBeenCalledTimes(1)
	})

	it('serves a fresh cache entry without re-running connect', async () => {
		const adapter = stubAdapter()
		const queryClient = new QueryClient()
		const options = schemaQueryOptions(adapter, queryClient, 'conn-1')

		await queryClient.fetchQuery(options)
		await queryClient.fetchQuery(options)

		expect(adapter.connectToDatabase).toHaveBeenCalledTimes(1)
	})

	it('mirrors the schema into the workspace store with a real timestamp', async () => {
		const adapter = stubAdapter()
		const queryClient = new QueryClient()

		await queryClient.fetchQuery(schemaQueryOptions(adapter, queryClient, 'conn-1'))

		const entry = readSchemaEntry('conn-1')
		expect(entry?.schema).toEqual(SCHEMA)
		expect(entry?.fetchedAt).toBeGreaterThan(0)
	})

	it('surfaces a failed connect as a thrown error', async () => {
		const adapter = stubAdapter()
		adapter.connectToDatabase.mockResolvedValueOnce({
			ok: true as const,
			data: { connected: false, fileSources: null }
		})
		const queryClient = new QueryClient()

		await expect(
			queryClient.fetchQuery(schemaQueryOptions(adapter, queryClient, 'conn-1'))
		).rejects.toThrow('Could not connect to this database')
		expect(adapter.getSchema).not.toHaveBeenCalled()
	})
})
