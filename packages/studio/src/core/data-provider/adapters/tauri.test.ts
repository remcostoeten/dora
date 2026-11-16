import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConnectionInfo, StatementResult } from '@studio/lib/bindings'
import { noop } from '@studio/shared/utils/noop'
import { getAdapterError } from '../types'
import { createTauriAdapter } from './tauri'

type Replies = Record<string, (args: Record<string, unknown>) => unknown>

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'

function connectionInfo(databaseType: ConnectionInfo['database_type']): ConnectionInfo {
	return {
		id: CONNECTION_ID,
		name: 'Local',
		connected: true,
		database_type: databaseType,
		last_connected_at: null,
		created_at: null,
		updated_at: null,
		pin_hash: null,
		favorite: null,
		color: null,
		sort_order: null
	}
}

function statement(overrides: Partial<StatementResult> = {}): StatementResult {
	return {
		query_id: 7,
		status: 'Completed',
		columns: ['id', 'name'],
		first_page: [
			[1, 'ada'],
			[2, 'grace']
		],
		page_count: 1,
		rows_received: 2,
		affected_rows: 0,
		error: null,
		...overrides
	}
}

function recordInvocations(replies: Replies) {
	const invocations: { command: string; args: Record<string, unknown> }[] = []
	mockIPC((command, payload) => {
		const args = (payload ?? {}) as Record<string, unknown>
		invocations.push({ command, args })
		const reply = replies[command]
		if (!reply) throw new Error(`Unexpected command: ${command}`)
		return reply(args)
	})
	return invocations
}

async function adapterWithKnownDialect(replies: Replies) {
	const invocations = recordInvocations({
		get_connections: () => [
			connectionInfo({
				Postgres: { connection_string: 'postgres://dora@localhost/dora', ssh_config: null }
			})
		],
		...replies
	})
	const adapter = createTauriAdapter()
	await adapter.getConnections()
	invocations.length = 0
	return { adapter, invocations }
}

describe('tauri adapter fetchTableData', () => {
	afterEach(() => {
		clearMocks()
	})

	it('opens a table with a single command', async () => {
		const { adapter, invocations } = await adapterWithKnownDialect({
			run_query: () => statement()
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)

		expect(invocations).toEqual([
			{
				command: 'run_query',
				args: {
					connectionId: CONNECTION_ID,
					query: 'SELECT * FROM "public"."users" LIMIT 50',
					timeoutMs: 30_000
				}
			}
		])
		expect(result.ok && result.data.rows).toEqual([
			{ id: 1, name: 'ada' },
			{ id: 2, name: 'grace' }
		])
		expect(result.ok && result.data.columns.map((column) => column.name)).toEqual([
			'id',
			'name'
		])
		expect(result.ok && result.data.totalCount).toBe(0)
	})

	it('pages past the first page of a larger result', async () => {
		const { adapter, invocations } = await adapterWithKnownDialect({
			run_query: () => statement({ page_count: 2, rows_received: 3 }),
			fetch_page: () => [[3, 'linus']]
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 1, 1000)

		expect(invocations.map((invocation) => invocation.command)).toEqual([
			'run_query',
			'fetch_page'
		])
		expect(invocations[0].args.query).toBe(
			'SELECT * FROM "public"."users" LIMIT 1000 OFFSET 1000'
		)
		expect(invocations[1].args).toEqual({ queryId: 7, pageIndex: 1 })
		expect(result.ok && result.data.rows).toEqual([
			{ id: 1, name: 'ada' },
			{ id: 2, name: 'grace' },
			{ id: 3, name: 'linus' }
		])
	})

	it('returns the statement error as the engine reported it', async () => {
		const { adapter } = await adapterWithKnownDialect({
			run_query: () =>
				statement({
					status: 'Error',
					columns: null,
					first_page: null,
					page_count: 0,
					rows_received: 0,
					affected_rows: null,
					error: 'Database error: relation "public.users" does not exist'
				})
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)

		expect(result.ok).toBe(false)
		expect(getAdapterError(result)).toBe(
			'Database error: relation "public.users" does not exist'
		)
	})

	it('reports a cancelled read as Query cancelled', async () => {
		const { adapter } = await adapterWithKnownDialect({
			run_query: () => statement({ status: 'Error', error: 'Query cancelled' })
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)

		expect(getAdapterError(result)).toBe('Query cancelled')
	})

	it('reports a statement that outlived the wait as still running', async () => {
		const { adapter } = await adapterWithKnownDialect({
			run_query: () =>
				statement({ status: 'Running', first_page: null, page_count: 0, rows_received: 0 })
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)

		expect(result.ok).toBe(false)
		expect(getAdapterError(result)).toContain('Query is still running after 30s')
	})

	it('formats a command that failed to start', async () => {
		const { adapter } = await adapterWithKnownDialect({
			run_query: () => {
				throw {
					kind: 'ConnectionNotFound',
					detail: `Connection not found: ${CONNECTION_ID}`
				}
			}
		})

		const result = await adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)

		expect(getAdapterError(result)).toBe(`Connection not found: ${CONNECTION_ID}`)
	})

	it('waits for an opening connection instead of failing against it', async () => {
		let finishConnect = noop
		const connecting = new Promise<void>((resolve) => {
			finishConnect = resolve
		})
		const { adapter, invocations } = await adapterWithKnownDialect({
			connect_to_database: async () => {
				await connecting
				return { connected: true, fileSources: null, error: null }
			},
			run_query: () => statement()
		})

		const connect = adapter.connectToDatabase(CONNECTION_ID)
		const read = adapter.fetchTableData(CONNECTION_ID, 'public.users', 0, 50)
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(invocations.map((invocation) => invocation.command)).toEqual(['connect_to_database'])

		finishConnect()
		const [connected, result] = await Promise.all([connect, read])

		expect(connected.ok && connected.data.connected).toBe(true)
		expect(result.ok).toBe(true)
		expect(invocations.map((invocation) => invocation.command)).toEqual([
			'connect_to_database',
			'run_query'
		])
	})

	it('knows the dialect of a connection it just added', async () => {
		const invocations = recordInvocations({
			add_connection: () =>
				connectionInfo({
					MySQL: { connection_string: 'mysql://root@localhost/dora', ssh_config: null }
				}),
			run_query: () => statement()
		})
		const adapter = createTauriAdapter()
		await adapter.addConnection('Local', {
			MySQL: { connection_string: 'mysql://root@localhost/dora', ssh_config: null }
		})
		invocations.length = 0

		await adapter.fetchTableData(CONNECTION_ID, 'dora.users', 0, 50)

		expect(invocations.map((invocation) => invocation.command)).toEqual(['run_query'])
		expect(invocations[0].args.query).toBe('SELECT * FROM `dora`.`users` LIMIT 50')
	})
})
