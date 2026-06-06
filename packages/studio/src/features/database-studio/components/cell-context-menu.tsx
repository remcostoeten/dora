import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger
} from '@studio/shared/ui/context-menu'
import { Copy, FileJson, Filter, Pencil, Trash2 } from 'lucide-react'
import { ColumnDefinition } from '../types'

type CellAction = 'copy' | 'copy-json' | 'filter-by-value' | 'edit' | 'set-null' | 'set-null-batch'

type BatchAction = {
	action: 'set-null-batch'
	rowIndexes: number[]
	column: ColumnDefinition
}

type Props = {
	value: unknown
	column: ColumnDefinition
	rowIndex: number
	colIndex?: number
	selectedRows?: Set<number>
	hasFilter?: boolean
	onAction?: (
		action: CellAction,
		value: unknown,
		column: ColumnDefinition,
		batchAction?: BatchAction
	) => void
	onOpenChange?: (open: boolean, rowIndex: number, colIndex: number) => void
	children: React.ReactNode
}

export function CellContextMenu({
	value,
	column,
	rowIndex,
	colIndex = 0,
	selectedRows,
	hasFilter = false,
	onAction,
	onOpenChange,
	children
}: Props) {
	function handleCopy() {
		const text = value === null || value === undefined ? '' : String(value)
		navigator.clipboard.writeText(text)
		onAction?.('copy', value, column)
	}

	function handleCopyJson() {
		const json = JSON.stringify(value, null, 2)
		navigator.clipboard.writeText(json)
		onAction?.('copy-json', value, column)
	}

	function handleFilterByValue() {
		onAction?.('filter-by-value', value, column)
	}

	function handleEdit() {
		setTimeout(function () {
			onAction?.('edit', value, column)
		}, 100)
	}

	function handleSetNull() {
		const hasSelected = selectedRows && selectedRows.size > 0

		if (hasSelected && selectedRows!.has(rowIndex)) {
			const batchAction: BatchAction = {
				action: 'set-null-batch',
				rowIndexes: Array.from(selectedRows!),
				column
			}
			onAction?.('set-null-batch', null, column, batchAction)
		} else {
			onAction?.('set-null', null, column)
		}
	}

	function handleOpenChange(open: boolean) {
		onOpenChange?.(open, rowIndex, colIndex)
	}

	const hasSelectedRows = selectedRows && selectedRows.size > 1 && selectedRows.has(rowIndex)
	const isComplexType = typeof value === 'object' && value !== null

	return (
		<ContextMenu onOpenChange={handleOpenChange}>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className='w-[180px]'>
				<ContextMenuItem onClick={handleEdit}>
					<Pencil />
					<span>Edit cell</span>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleCopy}>
					<Copy />
					<span>Copy value</span>
				</ContextMenuItem>
				{isComplexType && (
					<ContextMenuItem onClick={handleCopyJson}>
						<FileJson />
						<span>Copy as JSON</span>
					</ContextMenuItem>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleFilterByValue} disabled={!hasFilter}>
					<Filter />
					<span>Filter by this value</span>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleSetNull} variant='destructive'>
					<Trash2 />
					<span>
						{hasSelectedRows
							? `Set to NULL (${selectedRows!.size} rows)`
							: 'Set to NULL'}
					</span>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}

export type { CellAction }
