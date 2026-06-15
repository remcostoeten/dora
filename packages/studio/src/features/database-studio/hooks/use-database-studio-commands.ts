import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { convertSchemaToDrizzle } from '@studio/core/data-generation/sql-to-drizzle'
import { useIsTauri } from '@studio/core/data-provider'
import { getAdapterError, type DataAdapter } from '@studio/core/data-provider/types'
import { tableDataCache } from '@studio/core/table-cache'
import { commands } from '@studio/lib/bindings'
import { useToast } from '@studio/shared/ui/use-toast'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import type { ColumnFormData } from '../components/add-column-dialog'
import { rowsToCsv, rowsToSqlInsert, splitSqlStatements } from '../utils/studio-data'
import type { FilterConjunction, FilterDescriptor, FilterGroup, SortDescriptor, TableData } from '../types'

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
	filterGroup?: FilterGroup
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
	const isTauri = useIsTauri()
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
		filterGroup,
		loadTableData,
		setIsDdlLoading,
		setShowAddColumnDialog,
		setShowDropTableDialog,
		notifyActionFailure
	} = args

	// True when any filter is active (flat list or structured group). Drives the
	// "Export N matching rows" vs "Export all rows" choice in the export dialog.
	const hasActiveFilters =
		(filters?.length ?? 0) > 0 || (filterGroup?.conditions.length ?? 0) > 0

	// Fetches every row matching the active filters/sort (up to a cap) so an
	// export reflects what the user is looking at, not the whole table or just
	// the loaded page. When `ignoreFilters` is set the filters are dropped so the
	// full table is exported (sort is still honored). Returns null on failure
	// (caller already notified).
	async function fetchRowsForExport(ignoreFilters = false): Promise<TableData | null> {
		if (!activeConnectionId || !tableRefName) return null
		const result = await adapter.fetchTableData(
			activeConnectionId,
			tableRefName,
			0,
			EXPORT_ROW_CAP,
			sort,
			ignoreFilters ? undefined : filters,
			ignoreFilters ? undefined : filterConjunction,
			ignoreFilters ? undefined : filterGroup
		)
		if (!result.ok) {
			notifyActionFailure('Export failed', getAdapterError(result))
			return null
		}
		return result.data
	}

	async function handleExport(ignoreFilters = false) {
		const data = await fetchRowsForExport(ignoreFilters)
		if (!data || data.rows.length === 0) return
		downloadTextFile(
			JSON.stringify(data.rows, null, 2),
			`${tableName || 'data'}.json`,
			'application/json'
		)
	}

	async function handleExportCsvAll(ignoreFilters = false) {
		const data = await fetchRowsForExport(ignoreFilters)
		if (!data || data.rows.length === 0) return
		const csvString = rowsToCsv(
			data.rows,
			data.columns.map(function (col) {
				return col.name
			})
		)
		downloadTextFile(csvString, `${tableName || 'data'}.csv`, 'text/csv')
	}

	async function handleExportSqlAll(ignoreFilters = false) {
		const data = await fetchRowsForExport(ignoreFilters)
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

	async function handleBackupDatabase() {
		if (!activeConnectionId) return
		if (!isTauri) {
			toast({
				title: 'Backup unavailable',
				description: 'Backing up a database requires the desktop app.',
				variant: 'destructive'
			})
			return
		}

		const outputPath = await save({
			filters: [{ name: 'SQL dump', extensions: ['sql'] }],
			defaultPath: 'backup.sql'
		})
		if (!outputPath) return

		setIsDdlLoading(true)
		try {
			const result = await commands.dumpDatabase(activeConnectionId, outputPath)
			if (result.status !== 'ok') {
				throw new Error(result.error.detail)
			}
			const sizeKb = (result.data.size_bytes / 1024).toFixed(1)
			toast({
				title: 'Backup created',
				description: `${result.data.tables_dumped} tables, ${result.data.rows_dumped} rows (${sizeKb} KB) → ${result.data.file_path}`,
				variant: 'success'
			})
		} catch (error) {
			notifyActionFailure('Backup failed', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	async function handleRestoreDatabase() {
		if (!activeConnectionId) return
		if (!isTauri) {
			toast({
				title: 'Restore unavailable',
				description: 'Restoring from a backup requires the desktop app.',
				variant: 'destructive'
			})
			return
		}

		const selected = await open({
			multiple: false,
			filters: [{ name: 'SQL dump', extensions: ['sql'] }]
		})
		if (!selected || typeof selected !== 'string') return

		const confirmed = await ask(
			'Restoring runs every statement in the selected file against this connection and can overwrite existing data. Continue?',
			{ title: 'Restore from backup', kind: 'warning' }
		)
		if (!confirmed) return

		setIsDdlLoading(true)
		try {
			const sql = await readTextFile(selected)
			const statements = splitSqlStatements(sql)
			if (statements.length === 0) {
				toast({ title: 'Nothing to restore', description: 'The file has no SQL statements.' })
				return
			}
			const result = await commands.executeBatch(activeConnectionId, statements)
			if (result.status !== 'ok') {
				throw new Error(result.error.detail)
			}
			toast({
				title: 'Restore complete',
				description: `Ran ${statements.length} statements from the backup.`,
				variant: 'success'
			})
			loadTableData()
		} catch (error) {
			notifyActionFailure('Restore failed', error)
		} finally {
			setIsDdlLoading(false)
		}
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

	async function handleDropColumn(columnName: string) {
		if (!activeConnectionId || !tableRefName || !columnName) return

		setIsDdlLoading(true)
		try {
			const result = await adapter.dropColumn(activeConnectionId, tableRefName, columnName)
			if (result.ok) {
				tableDataCache.clear()
				window.dispatchEvent(
					new CustomEvent('dora-schema-refresh', { detail: { connectionId: activeConnectionId } })
				)
				toast({
					title: 'Column dropped',
					description: `"${columnName}" has been removed.`,
					variant: 'success'
				})
				loadTableData()
			} else {
				notifyActionFailure('Failed to drop column', getAdapterError(result))
			}
		} catch (error) {
			notifyActionFailure('Failed to drop column', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	return {
		handleExport,
		handleExportCsvAll,
		handleExportSqlAll,
		hasActiveFilters,
		handleBackupDatabase,
		handleRestoreDatabase,
		handleCopySchema,
		handleCopyDrizzleSchema,
		handleAddColumn,
		handleDropTable,
		handleDropColumn
	}
}
