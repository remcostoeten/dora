import { convertSchemaToDrizzle } from '@studio/core/data-generation/sql-to-drizzle'
import { getAdapterError, type DataAdapter } from '@studio/core/data-provider/types'
import { tableDataCache } from '@studio/core/table-cache'
import { commands } from '@studio/lib/bindings'
import { useToast } from '@studio/shared/ui/use-toast'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import type { ColumnFormData } from '../components/add-column-dialog'
import { rowsToCsv, rowsToSqlInsert } from '../utils/studio-data'
import type { FilterConjunction, FilterDescriptor, SortDescriptor, TableData } from '../types'

type Args = {
	adapter: DataAdapter
	activeConnectionId?: string
	tableId: string | null
	tableName: string | null
	tableRefName: string | null
	tableData: TableData | null
	sort?: SortDescriptor
	filters?: FilterDescriptor[]
	filterConjunction?: FilterConjunction
	loadTableData: () => void
	setIsDdlLoading: (value: boolean) => void
	setShowAddColumnDialog: (value: boolean) => void
	setShowDropTableDialog: (value: boolean) => void
	notifyActionFailure: (title: string, error: unknown) => void
}

/** Upper bound on rows fetched for an export, to avoid unbounded queries. */
const EXPORT_ROW_CAP = 100_000

function downloadTextFile(content: string, fileName: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = fileName
	a.click()
	URL.revokeObjectURL(url)
}

export function useDatabaseStudioCommands(args: Args) {
	const { toast } = useToast()
	const {
		adapter,
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		sort,
		filters,
		filterConjunction,
		loadTableData,
		setIsDdlLoading,
		setShowAddColumnDialog,
		setShowDropTableDialog,
		notifyActionFailure
	} = args

	// Fetches every row matching the active filters/sort (up to a cap) so an
	// export reflects what the user is looking at, not the whole table or just
	// the loaded page. Returns null on failure (caller already notified).
	async function fetchRowsForExport(): Promise<TableData | null> {
		if (!activeConnectionId || !tableRefName) return null
		const result = await adapter.fetchTableData(
			activeConnectionId,
			tableRefName,
			0,
			EXPORT_ROW_CAP,
			sort,
			filters,
			filterConjunction
		)
		if (!result.ok) {
			notifyActionFailure('Export failed', getAdapterError(result))
			return null
		}
		return result.data
	}

	async function handleExport() {
		const data = await fetchRowsForExport()
		if (!data || data.rows.length === 0) return
		downloadTextFile(
			JSON.stringify(data.rows, null, 2),
			`${tableName || 'data'}.json`,
			'application/json'
		)
	}

	async function handleExportCsvAll() {
		const data = await fetchRowsForExport()
		if (!data || data.rows.length === 0) return
		const csvString = rowsToCsv(
			data.rows,
			data.columns.map(function (col) {
				return col.name
			})
		)
		downloadTextFile(csvString, `${tableName || 'data'}.csv`, 'text/csv')
	}

	async function handleExportSqlAll() {
		const data = await fetchRowsForExport()
		if (!data || data.rows.length === 0) return
		const sqlString = rowsToSqlInsert(
			data.rows,
			getTableRefParts(tableRefName ?? '').tableName,
			data.columns.map(function (col) {
				return col.name
			})
		)
		downloadTextFile(sqlString, `${tableName || 'data'}.sql`, 'text/sql')
	}

	async function handleCopySchema() {
		if (!activeConnectionId) return

		try {
			const result = await adapter.getDatabaseDDL(activeConnectionId)
			if (result.ok) {
				navigator.clipboard.writeText(result.data)
				toast({
					title: 'Schema copied',
					description: 'Database schema DDL copied to clipboard.'
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			notifyActionFailure('Error copying schema', error)
		}
	}

	async function handleCopyDrizzleSchema() {
		if (!activeConnectionId) return

		try {
			const schemaResult = await adapter.getSchema(activeConnectionId)
			if (schemaResult.ok) {
				const drizzleSchema = convertSchemaToDrizzle(schemaResult.data)
				navigator.clipboard.writeText(drizzleSchema)
				toast({
					title: 'Drizzle schema copied',
					description: 'Database schema as Drizzle ORM format copied to clipboard.'
				})
			} else {
				throw new Error(getAdapterError(schemaResult))
			}
		} catch (error) {
			notifyActionFailure('Error copying schema', error)
		}
	}

	async function handleAddColumn(columnDef: ColumnFormData) {
		if (!activeConnectionId || !tableName) return

		setIsDdlLoading(true)
		try {
			let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnDef.name}" ${columnDef.type}`
			if (!columnDef.nullable) {
				sql += ' NOT NULL'
			}
			if (columnDef.defaultValue.trim()) {
				sql += ` DEFAULT ${columnDef.defaultValue}`
			}

			const result = await commands.executeBatch(activeConnectionId, [sql])
			if (result.status === 'ok') {
				setShowAddColumnDialog(false)
				tableDataCache.clear()
				window.dispatchEvent(
					new CustomEvent('dora-schema-refresh', { detail: { connectionId: activeConnectionId } })
				)
				loadTableData()
			} else {
				notifyActionFailure('Failed to add column', result.error)
			}
		} catch (error) {
			notifyActionFailure('Failed to add column', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	async function handleDropTable() {
		if (!activeConnectionId || !tableName) return

		setIsDdlLoading(true)
		try {
			const result = await adapter.dropTable(activeConnectionId, tableName)
			if (result.ok) {
				setShowDropTableDialog(false)
				tableDataCache.clear()
				window.dispatchEvent(
					new CustomEvent('dora-schema-refresh', { detail: { connectionId: activeConnectionId } })
				)
				toast({
					title: 'Table dropped',
					description: `"${tableName}" has been removed.`,
					variant: 'success'
				})
			} else {
				notifyActionFailure('Failed to drop table', getAdapterError(result))
			}
		} catch (error) {
			notifyActionFailure('Failed to drop table', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	return {
		handleExport,
		handleExportCsvAll,
		handleExportSqlAll,
		handleCopySchema,
		handleCopyDrizzleSchema,
		handleAddColumn,
		handleDropTable
	}
}
