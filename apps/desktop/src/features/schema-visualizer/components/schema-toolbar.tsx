import { useReactFlow } from '@xyflow/react'
import { motion, useReducedMotion } from 'framer-motion'
import {
	Download,
	MousePointer2,
	Maximize2,
	Map as MapIcon,
	RefreshCw,
	Search,
	X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

export type SearchSuggestion = {
	label: string
	type: 'table' | 'column'
}

type Props = {
	search: string
	onSearchChange: (v: string) => void
	suggestions: SearchSuggestion[]
	showMinimap: boolean
	onToggleMinimap: () => void
	editMode: boolean
	onToggleEditMode: () => void
	onRefresh: () => void
	onPreviewJson: () => void
	onExportSvg: () => void
	onExportPng: () => void
	onPreviewSql: () => void
	onPreviewDrizzle: () => void
	tableCount: number
	relatedTableCount: number
	edgeCount: number
	isSearchResult: boolean
	isLoading: boolean
}

type ToolbarIconButtonProps = {
	label: string
	children: ReactNode
	className?: string
	disabled?: boolean
	onClick?: () => void
}

let lastTooltipOpenedAt = 0

function ToolbarIconButton({
	label,
	children,
	className,
	disabled,
	onClick,
}: ToolbarIconButtonProps) {
	const prefersReducedMotion = useReducedMotion()
	const [open, setOpen] = useState(false)
	const closeTimerRef = useRef<number | null>(null)
	const openTimerRef = useRef<number | null>(null)

	const clearTimers = useCallback(function clearTimers() {
		if (openTimerRef.current !== null) {
			window.clearTimeout(openTimerRef.current)
			openTimerRef.current = null
		}
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current)
			closeTimerRef.current = null
		}
	}, [])

	const scheduleOpen = useCallback(
		function scheduleOpen(immediate: boolean) {
			clearTimers()
			const delay = immediate || prefersReducedMotion
				? 0
				: Date.now() - lastTooltipOpenedAt < 1400
					? 70
					: 450

			openTimerRef.current = window.setTimeout(function () {
				lastTooltipOpenedAt = Date.now()
				setOpen(true)
				openTimerRef.current = null
			}, delay)
		},
		[clearTimers, prefersReducedMotion],
	)

	const scheduleClose = useCallback(
		function scheduleClose(delay = 0) {
			clearTimers()
			closeTimerRef.current = window.setTimeout(function () {
				setOpen(false)
				closeTimerRef.current = null
			}, delay)
		},
		[clearTimers],
	)

	useEffect(function cleanup() {
		return function () {
			clearTimers()
		}
	}, [clearTimers])

	return (
		<Tooltip open={open}>
			<TooltipTrigger asChild>
				<motion.span
					className='inline-flex'
					onPointerEnter={() => scheduleOpen(false)}
					onPointerLeave={() => scheduleClose()}
					onPointerDown={() => scheduleOpen(true)}
					onPointerUp={(event) => {
						if (event.pointerType !== 'mouse') {
							scheduleClose(900)
						}
					}}
					onFocus={() => scheduleOpen(true)}
					onBlur={() => scheduleClose()}
					whileHover={
						disabled || prefersReducedMotion ? undefined : { y: -1 }
					}
					whileTap={
						disabled || prefersReducedMotion
							? undefined
							: { scale: 0.97 }
					}
					transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
				>
					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-7 w-7 origin-center will-change-transform',
							className,
						)}
						aria-label={label}
						disabled={disabled}
						onClick={onClick}
					>
						{children}
					</Button>
				</motion.span>
			</TooltipTrigger>
			<TooltipContent
				side='bottom'
				sideOffset={8}
				className='rounded-md border-sidebar-border/80 bg-sidebar px-2 py-1 text-[11px] text-sidebar-foreground'
			>
				{label}
			</TooltipContent>
		</Tooltip>
	)
}

function SearchBox({
	search,
	onSearchChange,
	suggestions,
}: {
	search: string
	onSearchChange: (v: string) => void
	suggestions: SearchSuggestion[]
}) {
	const [focused, setFocused] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const filtered = search.trim().length > 0
		? suggestions
			.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
			.slice(0, 10)
		: []

	const showDropdown = focused && filtered.length > 0

	function select(label: string) {
		onSearchChange(label)
		setFocused(false)
		setActiveIndex(-1)
		inputRef.current?.blur()
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!showDropdown) return
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, -1))
		} else if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault()
			select(filtered[activeIndex].label)
		} else if (e.key === 'Escape') {
			setFocused(false)
			setActiveIndex(-1)
		}
	}

	useEffect(function resetActiveOnChange() {
		setActiveIndex(-1)
	}, [search])

	useEffect(function handleClickOutside() {
		function onMouseDown(e: MouseEvent) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
				setFocused(false)
				setActiveIndex(-1)
			}
		}
		document.addEventListener('mousedown', onMouseDown)
		return () => document.removeEventListener('mousedown', onMouseDown)
	}, [])

	return (
		<div ref={wrapperRef} className='relative w-64'>
			<div className='relative flex items-center'>
				<Search className='pointer-events-none absolute left-2 h-3 w-3 text-muted-foreground' />
				<input
					ref={inputRef}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					onFocus={() => setFocused(true)}
					onKeyDown={handleKeyDown}
					placeholder='Search tables or columns…'
					className='sv-toolbar__search-input placeholder:text-muted-foreground'
				/>
				{search && (
					<button
						className='absolute right-1.5 text-muted-foreground transition-colors hover:text-foreground'
						onClick={() => { onSearchChange(''); inputRef.current?.focus() }}
						tabIndex={-1}
					>
						<X className='h-3 w-3' />
					</button>
				)}
			</div>

			{showDropdown && (
				<div className='absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-sidebar-border bg-sidebar shadow-lg'>
					{filtered.map((s, i) => (
						<button
							key={`${s.type}:${s.label}`}
							className={cn(
								'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
								i === activeIndex
									? 'bg-sidebar-accent text-sidebar-foreground'
									: 'text-sidebar-foreground hover:bg-sidebar-accent/60',
							)}
							onMouseDown={(e) => { e.preventDefault(); select(s.label) }}
						>
							<span
								className={cn(
									'shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider',
									s.type === 'table'
										? 'bg-[hsl(214_72%_58%/0.15)] text-[hsl(214_72%_68%)]'
										: 'bg-[hsl(168_52%_48%/0.15)] text-[hsl(168_52%_60%)]',
								)}
							>
								{s.type === 'table' ? 'tbl' : 'col'}
							</span>
							<span className='truncate font-mono'>{s.label}</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function SchemaToolbar({
	search,
	onSearchChange,
	suggestions,
	showMinimap,
	onToggleMinimap,
	editMode,
	onToggleEditMode,
	onRefresh,
	onPreviewJson,
	onExportSvg,
	onExportPng,
	onPreviewSql,
	onPreviewDrizzle,
	tableCount,
	relatedTableCount,
	edgeCount,
	isSearchResult,
	isLoading,
}: Props) {
	const { fitView } = useReactFlow()
	const summary = isSearchResult
		? `${tableCount} matches${relatedTableCount > 0 ? ` • ${relatedTableCount} related` : ''} • ${edgeCount} relationships`
		: `${tableCount} tables • ${edgeCount} relationships`

	return (
		<div className='sv-toolbar'>
			<div className='sv-toolbar__search-group'>
				<div className='sv-toolbar__copy'>
					<div className='sv-toolbar__label'>Explore the map</div>
					<div className='sv-toolbar__summary'>{summary}</div>
				</div>
				<SearchBox
					search={search}
					onSearchChange={onSearchChange}
					suggestions={suggestions}
				/>
			</div>

			<div className='sv-toolbar__actions'>
				<ToolbarIconButton
					label='Fit schema to viewport'
					onClick={() => fitView({ padding: 0.12, duration: 220 })}
				>
					<Maximize2 className='h-3.5 w-3.5' />
				</ToolbarIconButton>
				<ToolbarIconButton
					label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
					className={cn(editMode && 'sv-toolbar__toggle--active')}
					onClick={onToggleEditMode}
				>
					<MousePointer2 className='h-3.5 w-3.5' />
				</ToolbarIconButton>
				<ToolbarIconButton
					label={showMinimap ? 'Hide minimap' : 'Show minimap'}
					className={cn(showMinimap && 'sv-toolbar__toggle--active')}
					onClick={onToggleMinimap}
				>
					<MapIcon className='h-3.5 w-3.5' />
				</ToolbarIconButton>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7'
							aria-label='Export schema'
							disabled={tableCount === 0}
						>
							<Download className='h-3.5 w-3.5' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-44 shadow-none'>
						<DropdownMenuItem onClick={onExportSvg}>Export SVG</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPng}>Export PNG</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onPreviewSql}>Export SQL</DropdownMenuItem>
						<DropdownMenuItem onClick={onPreviewDrizzle}>Export Drizzle</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onPreviewJson}>Export JSON</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<ToolbarIconButton
					label={isLoading ? 'Refreshing schema…' : 'Refresh schema'}
					disabled={isLoading}
					onClick={onRefresh}
				>
					<RefreshCw
						className={cn(
							'h-3.5 w-3.5',
							isLoading && 'animate-spin',
						)}
					/>
				</ToolbarIconButton>
			</div>
		</div>
	)
}
