import {
	Table2,
	MoreHorizontal,
	CornerDownRight,
	Eye,
	Copy,
	FileJson,
	FileCode,
	Pencil,
	Trash2,
	CopyPlus,
	Download,
	Check,
	X,
	Info
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
	ContextMenuTrigger
} from '@/shared/ui/context-menu'
import { cn } from '@/shared/utils/cn'
import { TableItem, SortedColumn } from '../types'
import { TableContextMenu } from './table-context-menu'

type TableRightClickAction =
	| 'view-table'
	| 'view-info'
	| 'edit-name'
	| 'delete-table'
	| 'duplicate-table'
	| 'copy-name'
	| 'export-schema'
	| 'export-json'
	| 'export-sql'

function getTableIcon(type: TableItem['type']) {
	switch (type) {
		case 'view':
			return Eye
		case 'materialized-view':
			return Eye
		default:
			return Table2
	}
}

function formatRowCount(count: number | string): string {
	if (typeof count === 'string') return count
	if (count >= 1000) {
		return `${(count / 1000).toFixed(count >= 10000 ? 1 : 2).replace(/\.?0+$/, '')}K`
	}
	return count.toString()
}

type TableItemRowProps = {
	item: TableItem
	isSelected?: boolean
	isActive?: boolean
	isMultiSelectMode?: boolean
	hasSorting?: boolean
	isEditing?: boolean
	onEditStart?: (tableId: string) => void
	onEditSave?: (tableId: string, newName: string) => void
	onEditCancel?: () => void
	onSelect?: () => void
	onMultiSelect?: (checked: boolean) => void
	onContextAction?: (action: string) => void
	onRightClickAction?: (action: TableRightClickAction, tableId: string) => void
}

function TableItemRow({
	item,
	isSelected,
	isActive,
	isMultiSelectMode,
	hasSorting,
	isEditing,
	onEditStart,
	onEditSave,
	onEditCancel,
	onSelect,
	onMultiSelect,
	onContextAction,
	onRightClickAction
}: TableItemRowProps) {
	const [showContextMenu, setShowContextMenu] = useState(false)
	const [editValue, setEditValue] = useState(item.name)
	const inputRef = useRef<HTMLInputElement>(null)
	const Icon = getTableIcon(item.type)
	const hasSortedColumns = hasSorting && item.sortedColumns && item.sortedColumns.length > 0

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	useEffect(() => {
		setEditValue(item.name)
	}, [item.name])

	function handleEditKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			if (editValue.trim() && editValue !== item.name) {
				onEditSave?.(item.id, editValue.trim())
			} else {
				onEditCancel?.()
			}
		} else if (e.key === 'Escape') {
			e.preventDefault()
			onEditCancel?.()
		}
	}

	function handleEditBlur() {
		if (editValue.trim() && editValue !== item.name) {
			onEditSave?.(item.id, editValue.trim())
		} else {
			onEditCancel?.()
		}
	}

	function handleRightClickAction(action: TableRightClickAction) {
		if (action === 'edit-name') {
			onEditStart?.(item.id)
			setShowContextMenu(false)
		} else {
			onRightClickAction?.(action, item.id)
		}
	}

	function handleCopyName() {
		navigator.clipboard.writeText(item.name)
		handleRightClickAction('copy-name')
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div>
					<div
						className={cn(
							'group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors',
							isActive && 'bg-sidebar-accent',
							!isActive && 'hover:bg-sidebar-accent/60'
						)}
						onClick={onSelect}
					>
						{isMultiSelectMode && (
							<Checkbox
								checked={isSelected}
								onCheckedChange={onMultiSelect}
								onClick={(e) => e.stopPropagation()}
								className='shrink-0'
							/>
						)}

						<Icon className='h-4 w-4 text-muted-foreground shrink-0' />

						{isEditing ? (
							<div className='flex-1 flex items-center gap-1'>
								<input
									ref={inputRef}
									type='text'
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onKeyDown={handleEditKeyDown}
									onBlur={handleEditBlur}
									data-no-shortcuts='true'
									className='flex-1 h-5 px-1 text-sm bg-transparent border-none outline-hidden'
									onClick={(e) => e.stopPropagation()}
									autoFocus
								/>
								<Button
									variant='ghost'
									size='icon'
									className='h-5 w-5 shrink-0'
									onClick={(e) => {
										e.stopPropagation()
										if (editValue.trim() && editValue !== item.name) {
											onEditSave?.(item.id, editValue.trim())
										}
									}}
								>
									<Check className='h-3 w-3' />
								</Button>
								<Button
									variant='ghost'
									size='icon'
									className='h-5 w-5 shrink-0'
									onClick={(e) => {
										e.stopPropagation()
										onEditCancel?.()
									}}
								>
									<X className='h-3 w-3' />
								</Button>
							</div>
						) : (
							<span className='flex-1 text-sm text-sidebar-foreground truncate'>
								{item.name}
							</span>
						)}

						{!showContextMenu && (
							<span className='text-xs text-muted-foreground tabular-nums shrink-0 group-hover:hidden'>
								{formatRowCount(item.rowCount)}
							</span>
						)}

						<TableContextMenu
							open={showContextMenu}
							onOpenChange={setShowContextMenu}
							onAction={(action) => onContextAction?.(action)}
						>
							<Button
								variant='ghost'
								size='icon'
								className={cn(
									'h-5 w-5 shrink-0 hidden group-hover:flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent',
									showContextMenu && 'opacity-100 flex'
								)}
								onClick={(e) => {
									e.stopPropagation()
									setShowContextMenu(true)
								}}
							>
								<MoreHorizontal className='h-3.5 w-3.5' />
							</Button>
						</TableContextMenu>
					</div>

					{hasSortedColumns && (
						<div className='ml-4'>
							{item.sortedColumns?.map((col) => (
								<SortedColumnRow key={col.id} column={col} />
							))}
						</div>
					)}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className='w-[200px]'>
				<ContextMenuItem onClick={() => handleRightClickAction('view-table')}>
					<Eye className='h-4 w-4 mr-2' />
					<span>View table</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={() => onEditStart?.(item.id)}>
					<Pencil className='h-4 w-4 mr-2' />
					<span>Edit name</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleRightClickAction('duplicate-table')}>
					<CopyPlus className='h-4 w-4 mr-2' />
					<span>Duplicate table</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleRightClickAction('view-info')}>
					<Info className='h-4 w-4 mr-2' />
					<span>View info</span>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleCopyName}>
					<Copy className='h-4 w-4 mr-2' />
					<span>Copy table name</span>
				</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<Download className='h-4 w-4 mr-2' />
						<span>Export</span>
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className='w-[160px]'>
						<ContextMenuItem onClick={() => handleRightClickAction('export-schema')}>
							<FileCode className='h-4 w-4 mr-2' />
							<span>Copy schema</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={() => handleRightClickAction('export-json')}>
							<FileJson className='h-4 w-4 mr-2' />
							<span>Copy as JSON</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={() => handleRightClickAction('export-sql')}>
							<FileCode className='h-4 w-4 mr-2' />
							<span>Copy as SQL</span>
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={() => handleRightClickAction('delete-table')}
					className='text-destructive focus:text-destructive'
				>
					<Trash2 className='h-4 w-4 mr-2' />
					<span>Delete table</span>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}

type SortedColumnRowProps = {
	column: SortedColumn
}

function SortedColumnRow({ column }: SortedColumnRowProps) {
	return (
		<div className='flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:bg-sidebar-accent/40 cursor-pointer transition-colors'>
			<CornerDownRight className='h-3 w-3 shrink-0' />
			<span className='truncate'>{column.name}</span>
		</div>
	)
}

export type { TableRightClickAction }
type Props = {
	tables: TableItem[]
	activeTableId?: string
	selectedTableIds?: string[]
	isMultiSelectMode?: boolean
	activeSortingTableIds?: string[]
	editingTableId?: string
	onTableSelect?: (tableId: string) => void
	onTableMultiSelect?: (tableId: string, checked: boolean) => void
	onContextAction?: (tableId: string, action: string) => void
	onRightClickAction?: (action: TableRightClickAction, tableId: string) => void
	onTableRename?: (tableId: string, newName: string) => void
}

export function TableList({
	tables,
	activeTableId,
	selectedTableIds = [],
	isMultiSelectMode = false,
	activeSortingTableIds = [],
	editingTableId,
	onTableSelect,
	onTableMultiSelect,
	onContextAction,
	onRightClickAction,
	onTableRename
}: Props) {
	const [internalEditingId, setInternalEditingId] = useState<string | undefined>()
	const effectiveEditingId = editingTableId ?? internalEditingId

	function handleEditStart(tableId: string) {
		setInternalEditingId(tableId)
	}

	function handleEditSave(tableId: string, newName: string) {
		onTableRename?.(tableId, newName)
		setInternalEditingId(undefined)
	}

	function handleEditCancel() {
		setInternalEditingId(undefined)
	}
	return (
		<div className='flex flex-col py-1'>
			{tables.map((table) => (
				<TableItemRow
					key={table.id}
					item={table}
					isActive={activeTableId === table.id}
					isSelected={selectedTableIds.includes(table.id)}
					isMultiSelectMode={isMultiSelectMode}
					hasSorting={activeSortingTableIds.includes(table.id)}
					isEditing={effectiveEditingId === table.id}
					onEditStart={handleEditStart}
					onEditSave={handleEditSave}
					onEditCancel={handleEditCancel}
					onSelect={() => onTableSelect?.(table.id)}
					onMultiSelect={(checked) => onTableMultiSelect?.(table.id, checked)}
					onContextAction={(action) => onContextAction?.(table.id, action)}
					onRightClickAction={onRightClickAction}
				/>
			))}
		</div>
	)
}
