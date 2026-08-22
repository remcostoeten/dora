import type { DataAdapter } from '@studio/core/data-provider/types'
import {
	patchTableSnapshotRows,
	putTableSnapshot,
	readTableSnapshot,
	type TableSnapshot
} from '@studio/core/workspace-store'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import type {
	FilterConjunction,
	FilterDescriptor,
	FilterGroup,
	SortDescriptor,
	TableData
} from '../types'
import { enrichColumnsWithFKs } from './fk-enrichment'

/**
 * Snapshots are keyed by connection and table — one per table, holding the last
 * view of it. The signature identifies *which* view that is, so a snapshot is
 * only painted for a request whose paging, sort and filters match; anything
 * else falls through to a fetch.
 */
export function buildQuerySignature(
	limit: number,
	offset: number,
	sort: SortDescriptor | undefined,
	filters: FilterDescriptor[],
	conjunction: FilterConjunction = 'AND',
	filterGroup?: FilterGroup
): string {
	return JSON.stringify({
		limit,
		offset,
		sort: sort || null,
		filters,
		conjunction,
		filterGroup: filterGroup || null
	})
}

/**
 * The default page (no sort, no filters) the studio loads when a table is first
 * opened. Mirrors the initial `pagination`/`sort`/`filterGroup` state in
 * DatabaseStudio, so a prefetched snapshot matches the first request the studio
 * makes and the skeleton never flashes for an already-warm table.
 */
export const EMPTY_FILTER_GROUP: FilterGroup = { logic: 'AND', conditions: [] }
export const DEFAULT_PAGE_LIMIT = 50

export const DEFAULT_QUERY_SIGNATURE = buildQuerySignature(
	DEFAULT_PAGE_LIMIT,
	0,
	undefined,
	[],
	'AND',
	EMPTY_FILTER_GROUP
)

/** The grid's view of a snapshot. Execution time is not snapshotted. */
export function snapshotToTableData(snapshot: TableSnapshot): TableData {
	return {
		columns: snapshot.columns,
		rows: snapshot.rows,
		totalCount: snapshot.totalCount,
		executionTime: 0
	}
}

export function snapshotQuerySignature(snapshot: TableSnapshot): string {
	return buildQuerySignature(
		snapshot.limit,
		snapshot.offset,
		snapshot.sort,
		snapshot.filters ?? [],
		snapshot.conjunction ?? 'AND',
		snapshot.filterGroup
	)
}

/**
 * The stored snapshot for a table, but only when it holds the default page —
 * the exact view the studio requests on open. A snapshot of a sorted or
 * filtered view would paint rows the studio is not about to ask for.
 */
export function readDefaultPageSnapshot(
	connectionId: string | undefined,
	tableId: string | null
): TableSnapshot | undefined {
	const snapshot = readTableSnapshot(connectionId, tableId)
	if (!snapshot) return undefined
	return snapshotQuerySignature(snapshot) === DEFAULT_QUERY_SIGNATURE ? snapshot : undefined
}

/**
 * Apply an already-committed edit to the stored snapshot.
 *
 * The grid keeps the optimistic value on screen rather than refetching, so
 * without this the snapshot would still hold the pre-edit row and reopening the
 * table later would flash the old value back.
 */
export function patchSnapshotRows(
	connectionId: string | undefined,
	tableId: string | null,
	patchRow: (row: Record<string, unknown>) => Record<string, unknown>
): void {
	const snapshot = readTableSnapshot(connectionId, tableId)
	if (!snapshot) return
	patchTableSnapshotRows(snapshot.connectionId, snapshot.tableId, snapshot.rows.map(patchRow))
}

const inFlightPrefetches = new Set<string>()

/**
 * Best-effort warm of a table's default page into the snapshot slice, so
 * opening the table from the sidebar paints from the store instead of a fetch
 * plus a skeleton. Safe to call repeatedly: already-warm and in-flight tables
 * are skipped, and failures are swallowed — the real load surfaces errors.
 */
export async function prefetchTableSnapshot(
	adapter: DataAdapter,
	connectionId: string | undefined,
	tableRefName: string | null
) {
	if (!connectionId || !tableRefName) return

	const key = `${connectionId}::${tableRefName}`
	const existing = readTableSnapshot(connectionId, tableRefName)
	if (existing || inFlightPrefetches.has(key)) return

	inFlightPrefetches.add(key)
	try {
		const result = await adapter.fetchTableData(
			connectionId,
			tableRefName,
			0,
			DEFAULT_PAGE_LIMIT,
			undefined,
			[],
			'AND',
			EMPTY_FILTER_GROUP
		)
		if (!result.ok) return

		const data = result.data
		const schemaResult = await adapter.getSchema(connectionId)
		if (schemaResult.ok) {
			const { tableName, schemaName } = getTableRefParts(tableRefName)
			data.columns = enrichColumnsWithFKs(
				data.columns,
				schemaResult.data,
				tableName,
				schemaName ?? undefined
			)
		}

		if (readTableSnapshot(connectionId, tableRefName)) return

		putTableSnapshot({
			connectionId,
			tableId: tableRefName,
			columns: data.columns,
			rows: data.rows,
			totalCount: data.totalCount,
			visibleColumns: data.columns.map(function (column) {
				return column.name
			}),
			offset: 0,
			limit: DEFAULT_PAGE_LIMIT,
			filters: [],
			conjunction: 'AND',
			filterGroup: EMPTY_FILTER_GROUP,
			fetchedAt: Date.now()
		})
	} catch {
		// Prefetch is best-effort; ignore failures.
	} finally {
		inFlightPrefetches.delete(key)
	}
}

export function schemaHasTable(
	schema: { tables: Array<{ name: string; schema?: string | null }> },
	tableRef: string
) {
	const { tableName, schemaName } = getTableRefParts(tableRef)
	return schema.tables.some(function (table) {
		if (table.name !== tableName) return false
		if (!schemaName) return true
		return table.schema === schemaName
	})
}
