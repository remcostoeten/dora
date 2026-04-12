import { forwardRef, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
	Trash2,
	Copy,
	X,
	Ban,
	Download,
	FileJson,
	FileSpreadsheet,
	CopyPlus,
	Pencil,
	ChevronRight,
	Save
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/shared/ui/dropdown-menu'
import { cn } from '@/shared/utils/cn'

type Props = {
	selectedCount: number
	onDelete?: () => void
	onCopy?: () => void
	onSetNull?: () => void
	onDuplicate?: () => void
	onExportJson?: () => void
	onExportCsv?: () => void
	onBulkEdit?: () => void
	onSave?: () => void
	pendingEditCount?: number
	onClearSelection: () => void
	onEscapeToGrid?: () => void
	mode?: 'floating' | 'static'
}

type TActionItem = {
	id: string
	label: string
	icon: React.ReactNode
	onClick?: () => void
	ariaLabel: string
}

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Minimum toolbar width before we start collapsing items
const MIN_WIDTH_PER_ITEM = 94
// Fixed space for: badge + "Selected" + dividers + delete button + close button + margins
const FIXED_SPACE = 400

const SPRING_BEZIER = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const EASE_OUT_BEZIER = 'cubic-bezier(0.16, 1, 0.3, 1)'
const LAYOUT_SPRING = {
	type: 'spring',
	stiffness: 440,
	damping: 36,
	mass: 0.7
} as const

function createToolbarKeyHandler(onEscapeToGrid?: () => void) {
	return function handleToolbarKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
		const toolbar = e.currentTarget
		const focusable = Array.from(toolbar.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
		const idx = focusable.indexOf(document.activeElement as HTMLElement)

		switch (e.key) {
			case 'Escape':
				e.preventDefault()
				if (onEscapeToGrid) {
					onEscapeToGrid()
				}
				break
			case 'ArrowRight':
			case 'ArrowDown':
				if (idx === -1) return
				e.preventDefault()
				focusable[(idx + 1) % focusable.length]?.focus()
				break
			case 'ArrowLeft':
			case 'ArrowUp':
				if (idx === -1) return
				e.preventDefault()
				focusable[(idx - 1 + focusable.length) % focusable.length]?.focus()
				break
		}
	}
}

function ShortcutBadge({ children }: { children: React.ReactNode }) {
	return (
		<span
			className='ml-1 dark:bg-background/50 hidden lg:inline-flex h-4.5 min-w-[24px] items-center justify-center rounded-sm border border-border bg-background px-1.5 font-sans text-[9px] font-bold text-muted-foreground uppercase tracking-tight'
			aria-hidden='true'
		>
			{children}
		</span>
	)
}

export const SelectionActionBar = forwardRef<HTMLDivElement, Props>(function SelectionActionBar(
	{
		selectedCount,
		onDelete,
		onCopy,
		onSetNull,
		onDuplicate,
		onExportJson,
		onExportCsv,
		onBulkEdit,
		onSave,
		pendingEditCount = 0,
		onClearSelection,
		onEscapeToGrid,
		mode = 'floating'
	},
	ref
) {
	if (selectedCount === 0) return null

	const containerRef = useRef<HTMLDivElement>(null)
	const overflowRef = useRef<HTMLDivElement>(null)
	const [maxVisible, setMaxVisible] = useState(Infinity)
	const [expanded, setExpanded] = useState(false)
	// Track measured natural width of overflow content for smooth animation
	const [overflowWidth, setOverflowWidth] = useState(0)

	const hasExportOptions = onExportJson || onExportCsv
	const rowLabel = `${selectedCount} row${selectedCount !== 1 ? 's' : ''}`

	// Build the list of collapsible action items
	const collapsibleActions = useMemo(function buildActions() {
		const items: TActionItem[] = []

		if (onCopy) {
			items.push({
				id: 'copy',
				label: 'Copy',
				icon: <Copy className='h-3.5 w-3.5' aria-hidden='true' />,
				onClick: onCopy,
				ariaLabel: `Copy ${rowLabel} as JSON`
			})
		}

		if (onDuplicate) {
			items.push({
				id: 'duplicate',
				label: 'Duplicate',
				icon: <CopyPlus className='h-3.5 w-3.5' aria-hidden='true' />,
				onClick: onDuplicate,
				ariaLabel: `Duplicate ${rowLabel}`
			})
		}

		if (hasExportOptions) {
			items.push({
				id: 'export',
				label: 'Export',
				icon: <Download className='h-3.5 w-3.5' aria-hidden='true' />,
				onClick: undefined,
				ariaLabel: `Export ${rowLabel}`
			})
		}

		if (onBulkEdit) {
			items.push({
				id: 'edit',
				label: 'Edit',
				icon: <Pencil className='h-3.5 w-3.5' aria-hidden='true' />,
				onClick: onBulkEdit,
				ariaLabel: `Bulk edit ${rowLabel}`
			})
		}

		if (onSetNull) {
			items.push({
				id: 'setnull',
				label: 'Set NULL',
				icon: <Ban className='h-3.5 w-3.5' aria-hidden='true' />,
				onClick: onSetNull,
				ariaLabel: `Set NULL for ${rowLabel}`
			})
		}

		return items
	}, [onCopy, onDuplicate, hasExportOptions, onBulkEdit, onSetNull, rowLabel])

	// Responsive: measure parent container and decide how many items fit
	const measure = useCallback(function measureToolbar() {
		const el = containerRef.current
		if (!el) return

		const parentWidth = el.parentElement?.offsetWidth || window.innerWidth
		const budget = parentWidth - 40

		const availableForItems = budget - FIXED_SPACE
		const totalActions = collapsibleActions.length

		if (availableForItems >= totalActions * MIN_WIDTH_PER_ITEM) {
			setMaxVisible(Infinity)
			setExpanded(false)
		} else {
			const toggleWidth = 36
			const fitCount = Math.max(0, Math.floor((availableForItems - toggleWidth) / MIN_WIDTH_PER_ITEM))
			setMaxVisible(fitCount)
		}
	}, [collapsibleActions.length])

	useEffect(function observeSize() {
		const el = containerRef.current
		if (!el) return

		measure()

		const observer = new ResizeObserver(function handleResize() {
			measure()
		})

		if (el.parentElement) {
			observer.observe(el.parentElement)
		}
		observer.observe(el)

		return function cleanup() {
			observer.disconnect()
		}
	}, [measure])

	// Measure the natural width of overflow content for smooth width animation
	useEffect(function measureOverflow() {
		if (!overflowRef.current) return
		const el = overflowRef.current
		// Temporarily make visible to measure
		el.style.width = 'auto'
		el.style.position = 'absolute'
		el.style.visibility = 'hidden'
		el.style.overflow = 'visible'
		const w = el.scrollWidth
		el.style.width = ''
		el.style.position = ''
		el.style.visibility = ''
		el.style.overflow = ''
		setOverflowWidth(w)
	}, [collapsibleActions, maxVisible])

	const visibleActions = maxVisible >= collapsibleActions.length
		? collapsibleActions
		: collapsibleActions.slice(0, maxVisible)

	const overflowActions = maxVisible >= collapsibleActions.length
		? []
		: collapsibleActions.slice(maxVisible)

	const hasOverflow = overflowActions.length > 0

	function handleToggleExpand() {
		setExpanded(function (prev) {
			return !prev
		})
	}

	const floatingClasses = [
		'absolute bottom-10 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-[100]',
		'flex items-center gap-1.5 pl-4 pr-3 py-2',
		'bg-popover/95 backdrop-blur-sm border border-border shadow-2xl rounded-2xl',
		'animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out'
	]

	const staticClasses = [
		'flex items-center justify-between h-10 px-3 bg-sidebar border-t border-sidebar-border shrink-0',
		'animate-in slide-in-from-bottom-2 duration-200'
	]

	const isFloating = mode === 'floating'

	function getButtonClasses() {
		return cn(
			'text-xs gap-1.5 shrink-0',
			isFloating
				? 'h-8 px-3 hover:bg-primary/10 hover:text-primary'
				: 'h-7 px-2 text-muted-foreground hover:text-foreground'
		)
	}

	function renderActionButton(action: TActionItem) {
		// Special case: Export has a sub-dropdown
		if (action.id === 'export') {
			return (
				<DropdownMenu key={action.id}>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='sm'
							className={getButtonClasses()}
							title={action.ariaLabel}
							aria-label={`${action.ariaLabel} — opens format menu`}
							aria-haspopup='menu'
						>
							{action.icon}
							{action.label}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align={isFloating ? 'center' : 'start'}
						className='w-40'
					>
						{onExportJson && (
							<DropdownMenuItem onClick={onExportJson}>
								<FileJson className='h-3.5 w-3.5 mr-2' aria-hidden='true' />
								JSON
							</DropdownMenuItem>
						)}
						{onExportCsv && (
							<DropdownMenuItem onClick={onExportCsv}>
								<FileSpreadsheet
									className='h-3.5 w-3.5 mr-2'
									aria-hidden='true'
								/>
								CSV
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)
		}

		return (
			<Button
				key={action.id}
				variant='ghost'
				size='sm'
				className={getButtonClasses()}
				onClick={action.onClick}
				title={action.ariaLabel}
				aria-label={action.ariaLabel}
			>
				{action.icon}
				{action.label}
			</Button>
		)
	}

	return (
		<motion.div
			layout
			transition={LAYOUT_SPRING}
			ref={function mergeRefs(node: HTMLDivElement | null) {
				; (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
				if (typeof ref === 'function') {
					ref(node)
				} else if (ref) {
					; (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
				}
			}}
			role='toolbar'
			aria-label={`${rowLabel} selected — row actions. Use arrow keys to navigate between actions.`}
			tabIndex={-1}
			className={cn(
				mode === 'floating' ? floatingClasses : staticClasses,
				'outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
			)}
			onKeyDown={createToolbarKeyHandler(onEscapeToGrid)}
		>
			{/* ── Selection badge ─────────────────────────────────── */}
			<div className={cn('flex items-center gap-3 shrink-0', isFloating && 'mr-1')}>
				{isFloating ? (
					<>
						<span
							className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5'
							title={`${rowLabel} selected — press Alt+T to focus this toolbar`}
							aria-hidden='true'
						>
							{selectedCount}
						</span>
						<span className='text-sm font-medium text-foreground whitespace-nowrap'>
							<span className='sr-only'>{rowLabel} </span>
							Selected
						</span>
					</>
				) : (
					<div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
						<span
							className='bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full'
							aria-hidden='true'
						>
							{selectedCount}
						</span>
						<span>
							<span className='sr-only'>{selectedCount} </span>
							row{selectedCount !== 1 ? 's' : ''} selected
						</span>
					</div>
				)}
			</div>

			<div className='h-4 w-px bg-border mx-0.5 shrink-0' aria-hidden='true' />

			{/* ── Visible actions ─────────────────────────────────── */}
			<motion.div
				layout='position'
				transition={LAYOUT_SPRING}
				className='flex items-center gap-0.5'
				role='group'
				aria-label='Row actions'
			>
				<AnimatePresence initial={false} mode='popLayout'>
					{visibleActions.map(function mapAction(action) {
						return (
							<motion.div
								key={action.id}
								layout
								transition={LAYOUT_SPRING}
								initial={{ width: 0, opacity: 0, scale: 0.92 }}
								animate={{ width: 'auto', opacity: 1, scale: 1 }}
								exit={{
									width: 0,
									opacity: 0,
									scale: 0.92,
									transition: {
										width: { duration: 0.22, ease: [0.4, 0, 1, 1] },
										opacity: { duration: 0.16, ease: 'easeOut' },
										scale: { duration: 0.2, ease: 'easeIn' }
									}
								}}
								style={{
									display: 'flex',
									overflow: 'hidden',
									transformOrigin: 'left center'
								}}
							>
								{renderActionButton(action)}
							</motion.div>
						)
					})}
				</AnimatePresence>
			</motion.div>

			{/* ── Inline expand/collapse overflow ─────────────────── */}
			<AnimatePresence initial={false}>
				{hasOverflow && (
					<motion.div
						layout='position'
						transition={LAYOUT_SPRING}
						className='flex items-center gap-0.5'
						initial={{ width: 0, opacity: 0 }}
						animate={{ width: 'auto', opacity: 1 }}
						exit={{
							width: 0,
							opacity: 0,
							transition: {
								width: { duration: 0.2, ease: [0.4, 0, 1, 1] },
								opacity: { duration: 0.14, ease: 'easeOut' }
							}
						}}
						style={{ overflow: 'hidden' }}
					>
						{/* Toggle button — chevron rotates smoothly */}
						<button
							type='button'
							onClick={handleToggleExpand}
							className={cn(
								'shrink-0 flex items-center justify-center rounded-lg',
								'transition-all duration-300',
								isFloating
									? 'h-7 w-7 hover:bg-primary/10 text-muted-foreground hover:text-primary'
									: 'h-6 w-6 hover:bg-muted text-muted-foreground hover:text-foreground'
							)}
							title={expanded ? 'Collapse actions' : `${overflowActions.length} more actions`}
							aria-label={expanded ? 'Collapse actions' : `Show ${overflowActions.length} more actions`}
							aria-expanded={expanded}
						>
							<ChevronRight
								className='h-3.5 w-3.5'
								aria-hidden='true'
								style={{
									transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
									transition: `transform 400ms ${SPRING_BEZIER}`
								}}
							/>
						</button>

						{/* Expanding tray — width animates, items stagger in */}
						<motion.div
							layout
							transition={LAYOUT_SPRING}
							ref={overflowRef}
							className='overflow-hidden flex items-center gap-0.5'
							style={{
								width: expanded ? overflowWidth : 0,
								opacity: expanded ? 1 : 0,
								transition: expanded
									? `width 420ms ${SPRING_BEZIER}, opacity 300ms ${EASE_OUT_BEZIER}`
									: `width 320ms ${EASE_OUT_BEZIER}, opacity 180ms ease-out`
							}}
							aria-hidden={!expanded}
						>
							{/* Thin separator that fades in with the tray */}
							<div
								className='h-4 w-px bg-border shrink-0 mx-0.5'
								aria-hidden='true'
								style={{
									opacity: expanded ? 1 : 0,
									transition: `opacity 200ms ${expanded ? '120ms' : '0ms'} ease-out`
								}}
							/>

							{overflowActions.map(function mapOverflow(action, i) {
								const staggerDelay = expanded ? (i + 1) * 60 : 0
								const exitDelay = expanded ? 0 : (overflowActions.length - 1 - i) * 30

								return (
									<div
										key={action.id}
										style={{
											transform: expanded
												? 'translateX(0) scale(1)'
												: 'translateX(-8px) scale(0.92)',
											opacity: expanded ? 1 : 0,
											transition: expanded
												? `transform 400ms ${staggerDelay}ms ${SPRING_BEZIER}, opacity 280ms ${staggerDelay}ms ease-out`
												: `transform 200ms ${exitDelay}ms ease-in, opacity 150ms ${exitDelay}ms ease-in`,
											pointerEvents: expanded ? 'auto' : 'none'
										}}
									>
										{renderActionButton(action)}
									</div>
								)
							})}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Divider before destructive actions ──────────────── */}
			<motion.div
				layout='position'
				transition={LAYOUT_SPRING}
				className='h-4 w-px bg-border mx-0.5 shrink-0'
				aria-hidden='true'
			/>

			{/* ── Save + Delete + Close — always visible, never overflow ─── */}
			<motion.div
				layout='position'
				transition={LAYOUT_SPRING}
				className='flex items-center gap-1 shrink-0 ml-1'
			>
				{onSave && pendingEditCount > 0 && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5 shrink-0',
							isFloating
								? 'h-8.5 rounded-full pl-3 pr-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
								: 'h-7 px-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
						)}
						onClick={onSave}
						title={`Save ${pendingEditCount} pending edit${pendingEditCount !== 1 ? 's' : ''}`}
						aria-label={`Save ${pendingEditCount} pending edit${pendingEditCount !== 1 ? 's' : ''}`}
					>
						<Save className='h-3.5 w-3.5' aria-hidden='true' />
						Save
						{pendingEditCount > 0 && (
							<span className='ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white px-1'>
								{pendingEditCount}
							</span>
						)}
					</Button>
				)}

				{onDelete && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5 shrink-0',
							isFloating
								? 'h-8.5 rounded-full pl-3 pr-2 text-destructive hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300'
								: 'h-7 px-2 text-destructive hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
						)}
						onClick={onDelete}
						title={`Delete ${rowLabel} (Del)`}
						aria-label={`Delete ${rowLabel}`}
						aria-keyshortcuts='Delete'
					>
						<Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
						Delete
						<ShortcutBadge>Del</ShortcutBadge>
					</Button>
				)}

				{isFloating && <div className='h-4 w-px bg-border mx-1' aria-hidden='true' />}

				<Button
					variant='ghost'
					size='sm'
					className={cn(
						'hover:bg-muted shrink-0 gap-1.5',
						isFloating ? 'h-8.5 px-2 rounded-xl' : 'h-7 px-2 rounded-md ml-auto'
					)}
					onClick={onClearSelection}
					title='Clear selection (Esc)'
					aria-label='Clear selection'
					aria-keyshortcuts='Escape'
				>
					<X className='h-4 w-4' aria-hidden='true' />
					<ShortcutBadge>Esc</ShortcutBadge>
				</Button>
			</motion.div>
		</motion.div>
	)
})
