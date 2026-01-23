import { Eye, Pencil, CopyPlus, Trash2, FileDown, FileJson, FileCode } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from "@/shared/ui/context-menu";
import { ColumnDefinition } from "../types";

type RowAction = 'view' | 'edit' | 'duplicate' | 'delete' | 'export-json' | 'export-sql'

type Props = {
	row: Record<string, unknown>
	rowIndex: number
	columns: ColumnDefinition[]
	tableName?: string
	onAction?: (action: RowAction, row: Record<string, unknown>, rowIndex: number) => void
	onOpenChange?: (open: boolean, rowIndex: number) => void
	children: React.ReactNode
}

export function RowContextMenu({
	row,
	rowIndex,
	columns,
	tableName,
	onAction,
	onOpenChange,
	children
}: Props) {
	function handleAction(action: RowAction) {
		onAction?.(action, row, rowIndex)
	}

	function handleExportJson() {
		const json = JSON.stringify(row, null, 2)
		navigator.clipboard.writeText(json)
		handleAction('export-json')
	}

	function handleExportSql() {
		const columnNames = columns
			.map(function (c) {
				return c.name
			})
			.join(', ')
		const values = columns
			.map(function (c) {
				const val = row[c.name]
				if (val === null || val === undefined) return 'NULL'
				if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
				if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
				if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
				return String(val)
			})
			.join(', ')

		const sql = `INSERT INTO ${tableName || 'table_name'} (${columnNames}) VALUES (${values});`
		navigator.clipboard.writeText(sql)
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
				<ContextMenuItem
					onClick={function () {
						handleAction('view')
					}}
				>
					<Eye className='h-4 w-4 mr-2' />
					<span>View details</span>
				</ContextMenuItem>
				<ContextMenuItem
					onClick={function () {
						handleAction('edit')
					}}
				>
					<Pencil className='h-4 w-4 mr-2' />
					<span>Edit row</span>
				</ContextMenuItem>
				<ContextMenuItem
					onClick={function () {
						handleAction('duplicate')
					}}
				>
					<CopyPlus className='h-4 w-4 mr-2' />
					<span>Duplicate below</span>
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<FileDown className='h-4 w-4 mr-2' />
						<span>Export</span>
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className='w-[140px]'>
						<ContextMenuItem onClick={handleExportJson}>
							<FileJson className='h-4 w-4 mr-2' />
							<span>As JSON</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={handleExportSql}>
							<FileCode className='h-4 w-4 mr-2' />
							<span>Copy SQL INSERT</span>
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>

				<ContextMenuSeparator />

				<ContextMenuItem
					onClick={function () {
						handleAction('delete')
					}}
					className='text-red-600 focus:text-red-600 focus:bg-red-50 dark:text-red-400 dark:focus:bg-red-900/20'
				>
					<Trash2 className='h-4 w-4 mr-2' />
					<span>Delete row</span>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}

export type { RowAction }
