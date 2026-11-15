import type { Tab } from '@studio/core/tabs'
import type { ReactNode } from 'react'
import { memo, useState } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { useStableCallback } from '@studio/shared/hooks/use-stable-callback'
import { cn } from '@studio/shared/utils/cn'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger
} from '@studio/shared/ui/context-menu'

type Props = {
	tabs: Tab[]
	activeTabId: string | null
	onTabClick: (id: string) => void
	onTabClose: (id: string) => void
	onTabPinToggle?: (id: string) => void
	onCloseOtherTabs?: (id: string) => void
	onCloseTabsToLeft?: (id: string) => void
	onCloseTabsToRight?: (id: string) => void
	onTabReorder?: (fromId: string, toId: string) => void
	rightSlot?: ReactNode
}

type TabItemProps = {
	tab: Tab
	isActive: boolean
	isDragged: boolean
	isDropTarget: boolean
	isDraggable: boolean
	hasClosableLeftTab: boolean
	hasClosableRightTab: boolean
	hasClosableOtherTab: boolean
	onTabClick: (id: string) => void
	onTabClose: (id: string) => void
	onTabPinToggle?: (id: string) => void
	onCloseOtherTabs?: (id: string) => void
	onCloseTabsToLeft?: (id: string) => void
	onCloseTabsToRight?: (id: string) => void
	onDragStart: (event: React.DragEvent, id: string) => void
	onDragOver: (event: React.DragEvent, id: string) => void
	onDrop: (event: React.DragEvent, id: string) => void
	onDragEnd: () => void
}

const TabItem = memo(function TabItem({
	tab,
	isActive,
	isDragged,
	isDropTarget,
	isDraggable,
	hasClosableLeftTab,
	hasClosableRightTab,
	hasClosableOtherTab,
	onTabClick,
	onTabClose,
	onTabPinToggle,
	onCloseOtherTabs,
	onCloseTabsToLeft,
	onCloseTabsToRight,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd
}: TabItemProps) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={cn(
						'relative flex items-center h-full shrink-0 border-r border-border',
						isActive
							? 'bg-background text-foreground'
							: 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
						isDragged && 'opacity-50'
					)}
					data-tauri-drag-region='false'
					draggable={isDraggable}
					onDragStart={(e) => onDragStart(e, tab.id)}
					onDragOver={(e) => onDragOver(e, tab.id)}
					onDrop={(e) => onDrop(e, tab.id)}
					onDragEnd={onDragEnd}
				>
					{isDropTarget ? (
						<span
							aria-hidden='true'
							className='pointer-events-none absolute left-0 top-0 z-10 h-full w-0.5 bg-primary'
						/>
					) : null}
					<button
						onClick={() => onTabClick(tab.id)}
						onAuxClick={(e) => {
							if (e.button === 1) {
								e.preventDefault()
								onTabClose(tab.id)
							}
						}}
						className='flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium'
						data-tauri-drag-region='false'
					>
						{tab.pinned ? (
							<Pin className='h-3 w-3 shrink-0' aria-hidden='true' />
						) : null}
						<span className='max-w-[120px] truncate'>{tab.label}</span>
					</button>
					<button
						aria-label={`Close ${tab.label}`}
						onClick={(e) => {
							e.stopPropagation()
							onTabClose(tab.id)
						}}
						onAuxClick={(e) => {
							if (e.button === 1) {
								e.preventDefault()
								onTabClose(tab.id)
							}
						}}
						className='h-full px-1 pr-2 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground'
						data-tauri-drag-region='false'
					>
						<X className='h-3 w-3' />
					</button>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className='w-44'>
				<ContextMenuItem
					onClick={() => onTabPinToggle?.(tab.id)}
					disabled={!onTabPinToggle}
				>
					{tab.pinned ? <PinOff className='h-4 w-4' /> : <Pin className='h-4 w-4' />}
					{tab.pinned ? 'Unpin tab' : 'Pin tab'}
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => onTabClose(tab.id)}>
					<X className='h-4 w-4' />
					Close
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => onCloseOtherTabs?.(tab.id)}
					disabled={!onCloseOtherTabs || !hasClosableOtherTab}
				>
					Close others
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => onCloseTabsToLeft?.(tab.id)}
					disabled={!onCloseTabsToLeft || !hasClosableLeftTab}
				>
					Close tabs to left
				</ContextMenuItem>
				<ContextMenuItem
					onClick={() => onCloseTabsToRight?.(tab.id)}
					disabled={!onCloseTabsToRight || !hasClosableRightTab}
				>
					Close tabs to right
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
})

export function TabBar({
	tabs,
	activeTabId,
	onTabClick,
	onTabClose,
	onTabPinToggle,
	onCloseOtherTabs,
	onCloseTabsToLeft,
	onCloseTabsToRight,
	onTabReorder,
	rightSlot
}: Props) {
	// Track the in-flight drag so we can render a drop indicator and enforce the
	// pinned-zone constraint. `draggedId` is the tab being dragged; `dropTargetId`
	// is the tab we'd drop before, or null when no valid target is hovered.
	const [draggedId, setDraggedId] = useState<string | null>(null)
	const [dropTargetId, setDropTargetId] = useState<string | null>(null)

	function clearDrag() {
		setDraggedId(null)
		setDropTargetId(null)
	}

	// Reordering is only allowed within the same pinned/unpinned zone — a pinned
	// tab can't be dropped among unpinned tabs and vice versa.
	function isSameZone(a: string, b: string): boolean {
		const tabA = tabs.find((t) => t.id === a)
		const tabB = tabs.find((t) => t.id === b)
		if (!tabA || !tabB) return false
		return Boolean(tabA.pinned) === Boolean(tabB.pinned)
	}

	const handleTabClick = useStableCallback(onTabClick)
	const handleTabClose = useStableCallback(onTabClose)
	const handleDragEnd = useStableCallback(clearDrag)

	const handleDragStart = useStableCallback(function (event: React.DragEvent, id: string) {
		event.dataTransfer.setData('text/plain', id)
		event.dataTransfer.effectAllowed = 'move'
		setDraggedId(id)
	})

	const handleDragOver = useStableCallback(function (event: React.DragEvent, id: string) {
		if (!onTabReorder || !draggedId) return
		if (draggedId === id || !isSameZone(draggedId, id)) {
			if (dropTargetId !== null) setDropTargetId(null)
			return
		}
		event.preventDefault()
		event.dataTransfer.dropEffect = 'move'
		if (dropTargetId !== id) setDropTargetId(id)
	})

	const handleDrop = useStableCallback(function (event: React.DragEvent, id: string) {
		event.preventDefault()
		const fromId = event.dataTransfer.getData('text/plain') || draggedId
		if (fromId && fromId !== id && isSameZone(fromId, id)) {
			onTabReorder?.(fromId, id)
		}
		clearDrag()
	})

	return (
		<div
			className='flex items-center h-9 border-b border-border bg-sidebar shrink-0 select-none'
			data-tauri-drag-region='true'
		>
			<div className='flex h-full min-w-0 flex-1 items-center overflow-x-auto scrollbar-none'>
				{tabs.map((tab, index) => (
					<TabItem
						key={tab.id}
						tab={tab}
						isActive={tab.id === activeTabId}
						isDragged={draggedId === tab.id}
						isDropTarget={
							dropTargetId === tab.id && draggedId !== null && draggedId !== tab.id
						}
						isDraggable={Boolean(onTabReorder)}
						hasClosableLeftTab={tabs.slice(0, index).some((item) => !item.pinned)}
						hasClosableRightTab={tabs.slice(index + 1).some((item) => !item.pinned)}
						hasClosableOtherTab={tabs.some(
							(item) => item.id !== tab.id && !item.pinned
						)}
						onTabClick={handleTabClick}
						onTabClose={handleTabClose}
						onTabPinToggle={onTabPinToggle}
						onCloseOtherTabs={onCloseOtherTabs}
						onCloseTabsToLeft={onCloseTabsToLeft}
						onCloseTabsToRight={onCloseTabsToRight}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						onDragEnd={handleDragEnd}
					/>
				))}
			</div>
			{rightSlot ? (
				<div
					className='flex h-full shrink-0 items-center border-l border-border px-1'
					data-tauri-drag-region='false'
				>
					{rightSlot}
				</div>
			) : null}
		</div>
	)
}
