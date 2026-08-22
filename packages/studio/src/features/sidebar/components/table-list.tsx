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
	Info,
	Terminal
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useStableCallback } from '@studio/shared/hooks/use-stable-callback'
import { Button } from '@studio/shared/ui/button'
import { Checkbox } from '@studio/shared/ui/checkbox'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
	ContextMenuTrigger
} from '@studio/shared/ui/context-menu'
import { cn } from '@studio/shared/utils/cn'
import { TableItem, SortedColumn } from '../types'
import { TableContextMenu } from './table-context-menu'

export type TableRightClickAction =
	| 'view-table'
	| 'view-info'
	| 'edit-name'
	| 'delete-table'
	| 'duplicate-table'
	| 'copy-name'
	| 'export-schema'
	| 'export-json'
	| 'export-sql'
	| 'open-in-sql-console'
	| 'truncate'

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
	onEditStart: (tableId: string) => void
	onEditSave: (tableId: string, newName: string) => void
	onEditCancel: () => void
	onSelect: (tableId: string) => void
	onPrefetch: (tableId: string) => void
	onMultiSelect: (tableId: string, checked: boolean) => void
	onContextAction: (tableId: string, action: string) => void
	onArmContextMenu: (tableId: string) => void
}

/**
 * One sidebar row. Memoized: with 200 tables the list re-renders on every
 * navigation, and the rows whose props did not change must not. The row does
 * not own a context menu — it arms the list's shared one from `onContextMenu`
 * — and only mounts the "more actions" dropdown while it is open.
 */
const TableItemRow = memo(function TableItemRow({
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
	onPrefetch,
	onMultiSelect,
	onContextAction,
	onArmContextMenu
}: TableItemRowProps) {
	const [showContextMenu, setShowContextMenu] = useState(false)
	const [isMenuClosing, setIsMenuClosing] = useState(false)
	const closingTimerRef = useRef<number | undefined>(undefined)
	const [editValue, setEditValue] = useState(item.name)
	const inputRef = useRef<HTMLInputElement>(null)
	const Icon = getTableIcon(item.type)
	const hasSortedColumns = hasSorting && item.sortedColumns && item.sortedColumns.length > 0

	useEffect(function () {
		return function () {
			window.clearTimeout(closingTimerRef.current)
		}
	}, [])

	// Keep the trigger button mounted with a valid bounding box while the dropdown
	// plays its exit animation. Otherwise the anchor collapses to display:none and
	// Radix re-positions the still-visible menu to the top-left of the screen.
	function handleContextMenuOpenChange(open: boolean) {
		setShowContextMenu(open)
		window.clearTimeout(closingTimerRef.current)
		if (open) {
			setIsMenuClosing(false)
		} else {
			setIsMenuClosing(true)
			closingTimerRef.current = window.setTimeout(function () {
				setIsMenuClosing(false)
			}, 250)
		}
	}

	useEffect(() => {
		if (!isEditing) return

		function focusInput() {
			const input = inputRef.current
			if (!input) return
			input.focus()
			input.setSelectionRange(0, 0)
		}

		const frameId = requestAnimationFrame(focusInput)
		const timeoutId = window.setTimeout(focusInput, 0)

		return function () {
			cancelAnimationFrame(frameId)
			window.clearTimeout(timeoutId)
		}
	}, [isEditing])

	useEffect(() => {
		setEditValue(item.name)
	}, [item.name])

	function handleEditKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			if (editValue.trim() && editValue !== item.name) {
				onEditSave(item.id, editValue.trim())
			} else {
				onEditCancel()
			}
		} else if (e.key === 'Escape') {
			e.preventDefault()
			onEditCancel()
		}
	}

	function handleEditBlur() {
		if (editValue.trim() && editValue !== item.name) {
			onEditSave(item.id, editValue.trim())
		} else {
			onEditCancel()
		}
	}

	function startEditing() {
		requestAnimationFrame(function () {
			onEditStart(item.id)
		})
	}

	function handleRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
		if (isEditing) {
			return
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			onSelect(item.id)
			return
		}

		if (e.key === 'F2') {
			e.preventDefault()
			startEditing()
		}
	}

	const actionsButton = (
		<Button
			variant='ghost'
			size='icon'
			className={cn(
				'h-5 w-5 shrink-0 hidden group-hover:flex group-focus-within:flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent',
				(showContextMenu || isMenuClosing) && 'opacity-100 flex'
			)}
			aria-label={`Open actions for ${item.name}`}
			onClick={(e) => {
				e.stopPropagation()
				setShowContextMenu(true)
			}}
		>
			<MoreHorizontal className='h-3.5 w-3.5' />
		</Button>
	)

	return (
		<div>
			<div
				className={cn(
					'group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors outline-hidden focus-visible:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-sidebar-ring',
					isActive && 'bg-sidebar-accent',
					!isActive && 'hover:bg-sidebar-accent/60'
				)}
				role='treeitem'
				tabIndex={0}
				aria-current={isActive ? 'page' : undefined}
				aria-selected={isMultiSelectMode ? isSelected : undefined}
				aria-label={`${item.name}, ${item.type}, ${formatRowCount(item.rowCount)} rows`}
				onClick={() => onSelect(item.id)}
				onMouseEnter={() => onPrefetch(item.id)}
				onFocus={() => onPrefetch(item.id)}
				onKeyDown={handleRowKeyDown}
				onContextMenu={() => onArmContextMenu(item.id)}
			>
				{isMultiSelectMode && (
					<Checkbox
						checked={isSelected}
						onCheckedChange={(checked) => onMultiSelect(item.id, checked === true)}
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
						/>
						<Button
							variant='ghost'
							size='icon'
							className='h-5 w-5 shrink-0'
							aria-label={`Save table name for ${item.name}`}
							onClick={(e) => {
								e.stopPropagation()
								if (editValue.trim() && editValue !== item.name) {
									onEditSave(item.id, editValue.trim())
								}
							}}
						>
							<Check className='h-3 w-3' />
						</Button>
						<Button
							variant='ghost'
							size='icon'
							className='h-5 w-5 shrink-0'
							aria-label={`Cancel renaming ${item.name}`}
							onClick={(e) => {
								e.stopPropagation()
								onEditCancel()
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

				{!showContextMenu && !isMenuClosing && (
					<span className='text-xs text-muted-foreground tabular-nums shrink-0 group-hover:hidden'>
						{formatRowCount(item.rowCount)}
					</span>
				)}

				{showContextMenu || isMenuClosing ? (
					<TableContextMenu
						open={showContextMenu}
						onOpenChange={handleContextMenuOpenChange}
						onAction={(action) => onContextAction(item.id, action)}
					>
						{actionsButton}
					</TableContextMenu>
				) : (
					actionsButton
				)}
			</div>

			{hasSortedColumns && (
				<div className='ml-4'>
					{item.sortedColumns?.map((col) => (
						<SortedColumnRow key={col.id} column={col} />
					))}
				</div>
			)}
		</div>
	)
})

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

type TableRightClickMenuItemsProps = {
	onAction: (action: TableRightClickAction) => void
}

function TableRightClickMenuItems({ onAction }: TableRightClickMenuItemsProps) {
	return (
		<>
			<ContextMenuItem onClick={() => onAction('view-table')}>
				<Eye />
				<span>View table</span>
			</ContextMenuItem>
			<ContextMenuItem onClick={() => onAction('open-in-sql-console')}>
				<Terminal />
				<span>Open in SQL console</span>
			</ContextMenuItem>
			<ContextMenuItem onClick={() => onAction('edit-name')}>
				<Pencil />
				<span>Edit name</span>
			</ContextMenuItem>
			<ContextMenuItem onClick={() => onAction('duplicate-table')}>
				<CopyPlus />
				<span>Duplicate table</span>
			</ContextMenuItem>
			<ContextMenuItem onClick={() => onAction('view-info')}>
				<Info />
				<span>View info</span>
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onClick={() => onAction('copy-name')}>
				<Copy />
				<span>Copy table name</span>
			</ContextMenuItem>
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<Download />
					<span>Export</span>
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className='w-[160px]'>
					<ContextMenuItem onClick={() => onAction('export-schema')}>
						<FileCode />
						<span>Copy schema</span>
					</ContextMenuItem>
					<ContextMenuItem onClick={() => onAction('export-json')}>
						<FileJson />
						<span>Copy as JSON</span>
					</ContextMenuItem>
					<ContextMenuItem onClick={() => onAction('export-sql')}>
						<FileCode />
						<span>Copy as SQL</span>
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onClick={() => onAction('delete-table')} variant='destructive'>
				<Trash2 />
				<span>Delete table</span>
			</ContextMenuItem>
		</>
	)
}

type Props = {
	tables: TableItem[]
	activeTableId?: string
	selectedTableIds?: string[]
	isMultiSelectMode?: boolean
	activeSortingTableIds?: string[]
	editingTableId?: string
	onTableSelect?: (tableId: string) => void
	onTablePrefetch?: (tableId: string) => void
	onTableMultiSelect?: (tableId: string, checked: boolean) => void
	onContextAction?: (tableId: string, action: string) => void
	onRightClickAction?: (action: TableRightClickAction, tableId: string) => void
	onTableRename?: (tableId: string, newName: string) => void
}

const NO_IDS: string[] = []

export function TableList({
	tables,
	activeTableId,
	selectedTableIds = NO_IDS,
	isMultiSelectMode = false,
	activeSortingTableIds = NO_IDS,
	editingTableId,
	onTableSelect,
	onTablePrefetch,
	onTableMultiSelect,
	onContextAction,
	onRightClickAction,
	onTableRename
}: Props) {
	const [internalEditingId, setInternalEditingId] = useState<string | undefined>()
	const effectiveEditingId = editingTableId ?? internalEditingId

	const [menuTableId, setMenuTableId] = useState<string | null>(null)
	const armedTableIdRef = useRef<string | null>(null)

	const handleEditStart = useCallback(function handleEditStart(tableId: string) {
		setInternalEditingId(tableId)
	}, [])

	const handleEditSave = useStableCallback(function handleEditSave(
		tableId: string,
		newName: string
	) {
		onTableRename?.(tableId, newName)
		setInternalEditingId(undefined)
	})

	const handleEditCancel = useCallback(function handleEditCancel() {
		setInternalEditingId(undefined)
	}, [])

	const handleSelect = useStableCallback(function handleSelect(tableId: string) {
		onTableSelect?.(tableId)
	})
	const handlePrefetch = useStableCallback(function handlePrefetch(tableId: string) {
		onTablePrefetch?.(tableId)
	})
	const handleMultiSelect = useStableCallback(function handleMultiSelect(
		tableId: string,
		checked: boolean
	) {
		onTableMultiSelect?.(tableId, checked)
	})
	const handleContextAction = useStableCallback(function handleContextAction(
		tableId: string,
		action: string
	) {
		onContextAction?.(tableId, action)
	})

	const armContextMenu = useCallback(function armContextMenu(tableId: string) {
		armedTableIdRef.current = tableId
	}, [])

	function handleTriggerContextMenu(event: React.MouseEvent) {
		const armed = armedTableIdRef.current
		armedTableIdRef.current = null
		if (!armed) {
			event.preventDefault()
			return
		}
		setMenuTableId(armed)
	}

	function handleRightClickAction(action: TableRightClickAction) {
		if (!menuTableId) return
		if (action === 'edit-name') {
			const tableId = menuTableId
			requestAnimationFrame(function () {
				handleEditStart(tableId)
			})
			return
		}
		onRightClickAction?.(action, menuTableId)
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild onContextMenu={handleTriggerContextMenu}>
				<div className='flex flex-col py-1' role='tree' aria-label='Database tables'>
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
							onSelect={handleSelect}
							onPrefetch={handlePrefetch}
							onMultiSelect={handleMultiSelect}
							onContextAction={handleContextAction}
							onArmContextMenu={armContextMenu}
						/>
					))}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className='w-[200px]'>
				{menuTableId ? (
					<TableRightClickMenuItems onAction={handleRightClickAction} />
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}
