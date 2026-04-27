import { useState, useRef, useEffect } from 'react'
import { Plus, X, Loader2, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { useQueryTabs } from '../stores/tab-store'
import { cn } from '@/shared/utils/cn'
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator
} from '@/shared/ui/context-menu'

export function QueryTabBar() {
	const {
		tabs,
		activeTabId,
		setActiveTab,
		addTab,
		closeTab,
		renameTab,
		duplicateTab
	} = useQueryTabs()

	const [editingTabId, setEditingTabId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')
	const [showScrollButtons, setShowScrollButtons] = useState(false)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const editInputRef = useRef<HTMLInputElement>(null)

	// Check if we need scroll buttons
	useEffect(function () {
		function checkOverflow() {
			const el = scrollContainerRef.current
			if (el) {
				setShowScrollButtons(el.scrollWidth > el.clientWidth)
			}
		}

		checkOverflow()
		const observer = new ResizeObserver(checkOverflow)
		if (scrollContainerRef.current) {
			observer.observe(scrollContainerRef.current)
		}
		return function () { observer.disconnect() }
	}, [tabs.length])

	// Focus input when editing
	useEffect(function () {
		if (editingTabId && editInputRef.current) {
			editInputRef.current.focus()
			editInputRef.current.select()
		}
	}, [editingTabId])

	function handleDoubleClick(tabId: string, title: string) {
		setEditingTabId(tabId)
		setEditValue(title)
	}

	function handleRenameSubmit(tabId: string) {
		const trimmed = editValue.trim()
		if (trimmed) {
			renameTab(tabId, trimmed)
		}
		setEditingTabId(null)
	}

	function handleMiddleClick(e: React.MouseEvent, tabId: string) {
		if (e.button === 1 && tabs.length > 1) {
			e.preventDefault()
			closeTab(tabId)
		}
	}

	function scrollLeft() {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
		}
	}

	function scrollRight() {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
		}
	}

	return (
		<div className='query-tab-bar flex items-center h-[33px] bg-sidebar border-b border-sidebar-border shrink-0 select-none'>
			{/* Scroll left button */}
			{showScrollButtons && (
				<button
					className='flex items-center justify-center h-full w-6 shrink-0 text-muted-foreground hover:text-foreground transition-colors border-r border-sidebar-border'
					onClick={scrollLeft}
					title='Scroll tabs left'
				>
					<ChevronLeft className='h-3 w-3' />
				</button>
			)}

			{/* Tab scroll container */}
			<div
				ref={scrollContainerRef}
				className='flex items-end flex-1 overflow-x-auto scrollbar-hide h-full'
			>
				{tabs.map(function (tab, index) {
					const isActive = tab.id === activeTabId
					const isEditing = editingTabId === tab.id

					return (
						<ContextMenu key={tab.id}>
							<ContextMenuTrigger asChild>
								<button
									className={cn(
										'query-tab group relative flex items-center gap-1.5 h-full px-3 text-xs font-medium transition-all duration-150 border-r border-sidebar-border whitespace-nowrap min-w-[90px] max-w-[180px]',
										isActive
											? 'bg-background text-foreground query-tab--active'
											: 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
									)}
									onClick={function () { setActiveTab(tab.id) }}
									onMouseDown={function (e) { handleMiddleClick(e, tab.id) }}
									onDoubleClick={function () { handleDoubleClick(tab.id, tab.title) }}
									title={tab.title}
								>
									{/* Active indicator line */}
									{isActive && (
										<span className='absolute bottom-0 left-0 right-0 h-[2px] bg-primary query-tab-indicator' />
									)}

									{/* Executing spinner */}
									{tab.isExecuting && (
										<Loader2 className='h-3 w-3 shrink-0 animate-spin text-emerald-400' />
									)}

									{/* Dirty dot */}
									{tab.isDirty && !tab.isExecuting && (
										<span className='h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0' />
									)}

									{/* Tab title / edit input */}
									{isEditing ? (
										<input
											ref={editInputRef}
											className='bg-transparent border-none outline-none text-xs font-medium w-full min-w-[60px] text-foreground'
											value={editValue}
											onChange={function (e) { setEditValue(e.target.value) }}
											onBlur={function () { handleRenameSubmit(tab.id) }}
											onKeyDown={function (e) {
												if (e.key === 'Enter') {
													handleRenameSubmit(tab.id)
												} else if (e.key === 'Escape') {
													setEditingTabId(null)
												}
											}}
										/>
									) : (
										<span className='truncate'>{tab.title}</span>
									)}

									{/* Close button */}
									{tabs.length > 1 && !isEditing && (
										<span
											className={cn(
												'shrink-0 rounded-sm p-0.5 transition-all',
												isActive
													? 'opacity-60 hover:opacity-100 hover:bg-muted'
													: 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted'
											)}
											onClick={function (e) {
												e.stopPropagation()
												closeTab(tab.id)
											}}
											role='button'
											tabIndex={-1}
											title='Close tab (Ctrl+W)'
										>
											<X className='h-3 w-3' />
										</span>
									)}
								</button>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onClick={function () { handleDoubleClick(tab.id, tab.title) }}>
									Rename Tab
								</ContextMenuItem>
								<ContextMenuItem onClick={function () { duplicateTab(tab.id) }}>
									<Copy className='mr-2 h-3.5 w-3.5' />
									Duplicate Tab
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem
									disabled={tabs.length <= 1}
									className='text-destructive focus:text-destructive'
									onClick={function () { closeTab(tab.id) }}
								>
									<X className='mr-2 h-3.5 w-3.5' />
									Close Tab
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					)
				})}
			</div>

			{/* Scroll right button */}
			{showScrollButtons && (
				<button
					className='flex items-center justify-center h-full w-6 shrink-0 text-muted-foreground hover:text-foreground transition-colors border-l border-sidebar-border'
					onClick={scrollRight}
					title='Scroll tabs right'
				>
					<ChevronRight className='h-3 w-3' />
				</button>
			)}

			{/* New tab button */}
			<button
				className='flex items-center justify-center h-full w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors border-l border-sidebar-border'
				onClick={addTab}
				title='New tab (Ctrl+T)'
			>
				<Plus className='h-3.5 w-3.5' />
			</button>
		</div>
	)
}
