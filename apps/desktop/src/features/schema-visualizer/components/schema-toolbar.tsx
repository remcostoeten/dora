import { useReactFlow } from '@xyflow/react'
import { motion, useReducedMotion } from 'framer-motion'
import {
	Download,
	MousePointer2,
	Maximize2,
	Map as MapIcon,
	RefreshCw,
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
import { Input } from '@/shared/ui/input'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

type Props = {
	search: string
	onSearchChange: (v: string) => void
	showMinimap: boolean
	onToggleMinimap: () => void
	editMode: boolean
	onToggleEditMode: () => void
	onRefresh: () => void
	onExportJson: () => void
	onExportSvg: () => void
	onExportPng: () => void
	onExportSql: () => void
	onExportDrizzle: () => void
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

export function SchemaToolbar({
	search,
	onSearchChange,
	showMinimap,
	onToggleMinimap,
	editMode,
	onToggleEditMode,
	onRefresh,
	onExportJson,
	onExportSvg,
	onExportPng,
	onExportSql,
	onExportDrizzle,
	tableCount,
	relatedTableCount,
	edgeCount,
	isSearchResult,
	isLoading,
}: Props) {
	const { fitView } = useReactFlow()

	return (
		<div className='flex h-10 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar px-3'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				<div className='relative w-64'>
					<Input
						placeholder='Search tables, schemas, columns...'
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className='h-7 pr-6 text-xs'
					/>
					{search && (
						<button
							className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground'
							onClick={() => onSearchChange('')}
						>
							<X className='h-3 w-3' />
						</button>
					)}
				</div>
				<span className='whitespace-nowrap text-[11px] text-muted-foreground'>
					{isSearchResult
						? `${tableCount} matches${
								relatedTableCount > 0 ? ` • ${relatedTableCount} related` : ''
							} • ${edgeCount} relationships`
						: `${tableCount} tables • ${edgeCount} relationships`}
				</span>
			</div>

			<div className='flex items-center gap-1'>
				<ToolbarIconButton
					label='Fit schema to viewport'
					onClick={() => fitView({ padding: 0.12, duration: 220 })}
				>
					<Maximize2 className='h-3.5 w-3.5' />
				</ToolbarIconButton>
				<ToolbarIconButton
					label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
					className={cn(editMode && 'bg-sidebar-accent text-primary')}
					onClick={onToggleEditMode}
				>
					<MousePointer2 className='h-3.5 w-3.5' />
				</ToolbarIconButton>
				<ToolbarIconButton
					label={showMinimap ? 'Hide minimap' : 'Show minimap'}
					className={cn(
						showMinimap && 'bg-sidebar-accent text-primary',
					)}
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
						<DropdownMenuItem onClick={onExportSql}>Export SQL</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportDrizzle}>Export Drizzle</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onExportJson}>Export JSON</DropdownMenuItem>
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
