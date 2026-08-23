import { ContextMenuItem, ContextMenuSeparator } from '@studio/shared/ui/context-menu'
import { Binary, Copy, FileDown, FileJson, Filter, Pencil, Trash2 } from 'lucide-react'
import { ColumnDefinition } from '../types'
import { detectBlob } from './cells/blob-utils'

type CellAction = 'copy' | 'copy-json' | 'filter-by-value' | 'edit' | 'set-null' | 'set-null-batch'

/** Blob-specific actions that need the original bytes, resolved by the parent. */
type BlobAction = 'copy-hex' | 'copy-base64' | 'save-file'

type BatchAction = {
	action: 'set-null-batch'
	rowIndexes: number[]
	column: ColumnDefinition
}

type Props = {
	value: unknown
	column: ColumnDefinition
	rowIndex: number
	row?: Record<string, unknown>
	selectedRows?: Set<number>
	hasFilter?: boolean
	onAction?: (
		action: CellAction,
		value: unknown,
		column: ColumnDefinition,
		batchAction?: BatchAction
	) => void
	/** Handle a blob action; the parent re-fetches the original bytes. */
	onBlobAction?: (
		action: BlobAction,
		column: ColumnDefinition,
		row: Record<string, unknown>
	) => void
}

/**
 * The items of the cell context menu. Rendered inside the grid's single shared
 * `ContextMenuContent` for whichever cell was right-clicked, so the grid pays
 * for one menu instead of one per cell.
 */
export function CellContextMenuItems({
	value,
	column,
	rowIndex,
	row,
	selectedRows,
	hasFilter = false,
	onAction,
	onBlobAction
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
		onAction?.('edit', value, column)
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

	function handleBlobAction(action: BlobAction) {
		if (row && onBlobAction) onBlobAction(action, column, row)
	}

	const hasSelectedRows = selectedRows && selectedRows.size > 1 && selectedRows.has(rowIndex)
	const isComplexType = typeof value === 'object' && value !== null
	const blobInfo = detectBlob(value, column)
	const showBlobActions = !!blobInfo && !!row && !!onBlobAction

	return (
		<>
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
			{showBlobActions && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem
						onClick={function () {
							handleBlobAction('copy-hex')
						}}
					>
						<Binary />
						<span>Copy as hex</span>
					</ContextMenuItem>
					<ContextMenuItem
						onClick={function () {
							handleBlobAction('copy-base64')
						}}
					>
						<Copy />
						<span>Copy as base64</span>
					</ContextMenuItem>
					<ContextMenuItem
						onClick={function () {
							handleBlobAction('save-file')
						}}
					>
						<FileDown />
						<span>Save to file…</span>
					</ContextMenuItem>
				</>
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
					{hasSelectedRows ? `Set to NULL (${selectedRows!.size} rows)` : 'Set to NULL'}
				</span>
			</ContextMenuItem>
		</>
	)
}

export type { CellAction, BlobAction }
