import { Eye, Pencil, CopyPlus, Trash2, FileDown, FileJson, FileCode } from 'lucide-react'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent
} from '@studio/shared/ui/context-menu'
import { ColumnDefinition } from '../types'

type RowAction = 'view' | 'edit' | 'duplicate' | 'delete' | 'export-json' | 'export-sql'

type Props = {
	row: Record<string, unknown>
	rowIndex: number
	columns: ColumnDefinition[]
	tableName?: string
	allRows?: Record<string, unknown>[]
	onAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	onOpenChange?: (open: boolean, rowIndex: number) => void
	selectedRows?: Set<number>
	/** Privacy mode: render the row without any context menu (no copy/edit/export). */
	disabled?: boolean
	children: React.ReactNode
}

export function RowContextMenu({
	row,
	rowIndex,
	columns,
	tableName,
	allRows,
	onAction,
	onOpenChange,
	selectedRows,
	disabled = false,
	children
}: Props) {
	if (disabled) {
		return <>{children}</>
	}

	const isSelected = selectedRows?.has(rowIndex)
	const batchCount = isSelected && selectedRows ? selectedRows.size : 0
	const isBatch = batchCount > 1

	function handleAction(action: RowAction) {
		const batchIndexes = isBatch && selectedRows ? Array.from(selectedRows) : undefined
		onAction?.(action, row, rowIndex, batchIndexes)
	}

	function handleExportJson() {
		const rows = isBatch && selectedRows && allRows
			? Array.from(selectedRows).map(function (i) { return allRows[i] }).filter(Boolean)
			: [row]
		const json = JSON.stringify(isBatch && selectedRows ? rows : row, null, 2)
		const blob = new Blob([json], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_export.json`
		a.click()
		URL.revokeObjectURL(url)
		handleAction('export-json')
	}

	function handleExportSql() {
		const columnNames = columns.map(function (c) { return c.name }).join(', ')

		function rowToValues(r: Record<string, unknown>) {
			return columns.map(function (c) {
				const val = r[c.name]
				if (val === null || val === undefined) return 'NULL'
				if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
				if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
				if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
				return String(val)
			}).join(', ')
		}

		const sql = `INSERT INTO ${tableName || 'table_name'} (${columnNames}) VALUES (${rowToValues(row)});`
		const blob = new Blob([sql], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_export.sql`
		a.click()
		URL.revokeObjectURL(url)
		handleAction('export-sql')
	}

	function handleOpenChange(open: boolean) {
		if (onOpenChange) {
			onOpenChange(open, rowIndex)
		}
	}

	return (
		<ContextMenu onOpenChange={handleOpenChange}>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className='w-[180px]'>
				<ContextMenuItem onClick={function () { handleAction('view') }}>
					<Eye />
					<span>View details</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={function () { handleAction('edit') }}>
					<Pencil />
					<span>Edit row</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={function () { handleAction('duplicate') }}>
					<CopyPlus />
					<span>{isBatch ? `Duplicate ${batchCount} rows` : 'Duplicate below'}</span>
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FileDown />
						<span>Export</span>
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className='w-[140px]'>
						<ContextMenuItem onClick={handleExportJson}>
							<FileJson />
							<span>{isBatch ? `As JSON (${batchCount} rows)` : 'As JSON'}</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={handleExportSql}>
							<FileCode />
							<span>
								{isBatch
									? `Copy SQL INSERT (${batchCount} rows)`
									: 'Copy SQL INSERT'}
							</span>
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>

				<ContextMenuSeparator />

				<ContextMenuItem
					onClick={function () { handleAction('delete') }}
					variant='destructive'
				>
					<Trash2 />
					<span>{isBatch ? `Delete ${batchCount} rows` : 'Delete row'}</span>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}

export type { RowAction }
