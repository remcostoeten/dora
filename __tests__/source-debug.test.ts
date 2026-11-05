import { resolveSourceDebugInfo } from '@studio/features/connections/source-debug'
import { buildConnectionFromDataFiles } from '@studio/features/connections/utils/data-files'
import type { Connection } from '@studio/features/connections/types'
import { describe, expect, it } from 'vitest'

describe('source-debug', function () {
	it('resolves debug payload for a data-file session', function () {
		const conn: Connection = {
			id: '1',
			name: 'sales',
			createdAt: 0,
			...buildConnectionFromDataFiles(['/tmp/sales.csv'])
		}
		const info = resolveSourceDebugInfo(conn)

		expect(info.kind).toBe('data-file')
		expect(info.engine).toBe('duckdb')
		expect(info.preset).toBe('duckdb')
		expect(info.wireFamily).toBe('duckdb')
		expect(info.isReadonly).toBe(true)
		expect(info.visibleUiActions).toContain('export-data')
		expect(info.visibleUiActions).not.toContain('edit-rows')
	})
})
