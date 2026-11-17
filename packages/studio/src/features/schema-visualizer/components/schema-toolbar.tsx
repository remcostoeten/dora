import {
	Database,
	Download,
	Hand,
	Map as MapIcon,
	Maximize,
	Move,
	PanelLeft,
	PanelRight,
	RefreshCw,
	Search,
	X
} from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	searchInputRef: RefObject<HTMLInputElement>
	search: string
	onSearchChange: (value: string) => void
	searchMeta: string | null
	schemaLabel: string
	summary: string
	showNav: boolean
	onToggleNav: () => void
	showDetails: boolean
	onToggleDetails: () => void
	showMinimap: boolean
	onToggleMinimap: () => void
	editMode: boolean
	onEditModeChange: (value: boolean) => void
	onFit: () => void
	onRefresh: () => void
	onPreviewJson: () => void
	onExportSvg: () => void
	onExportPng: () => void
	onPreviewSql: () => void
	onPreviewDrizzle: () => void
	canExport: boolean
	isLoading: boolean
	rightSlot?: ReactNode
}

function IconButton({
	label,
	active,
	disabled,
	onClick,
	children
}: {
	label: string
	active?: boolean
	disabled?: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type='button'
					className={cn('sv-ibtn', active && 'is-active')}
					aria-label={label}
					aria-pressed={active}
					disabled={disabled}
					onClick={onClick}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side='bottom' sideOffset={6} className='text-[11px]'>
				{label}
			</TooltipContent>
		</Tooltip>
	)
}

export function SchemaToolbar({
	searchInputRef,
	search,
	onSearchChange,
	searchMeta,
	schemaLabel,
	summary,
	showNav,
	onToggleNav,
	showDetails,
	onToggleDetails,
	showMinimap,
	onToggleMinimap,
	editMode,
	onEditModeChange,
	onFit,
	onRefresh,
	onPreviewJson,
	onExportSvg,
	onExportPng,
	onPreviewSql,
	onPreviewDrizzle,
	canExport,
	isLoading,
	rightSlot
}: Props) {
	return (
		<header className='sv-toolbar' data-tauri-drag-region='true'>
			<div className='sv-toolbar__left' data-tauri-drag-region='false'>
				<IconButton label='Table list' active={showNav} onClick={onToggleNav}>
					<PanelLeft className='h-4 w-4' />
				</IconButton>
				<div className='sv-toolbar__title' title={summary}>
					<Database className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
					<span className='sv-toolbar__schema'>{schemaLabel}</span>
					<span className='sv-toolbar__summary'>{summary}</span>
				</div>
			</div>

			<label className='sv-search' data-tauri-drag-region='false' title='Search (/)'>
				<Search className='h-3.5 w-3.5 shrink-0' />
				<input
					ref={searchInputRef}
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault()
							if (search) onSearchChange('')
							else event.currentTarget.blur()
						}
					}}
					placeholder='Search tables, columns, types'
					autoComplete='off'
					spellCheck={false}
					aria-label='Search tables, columns and types'
				/>
				{search ? (
					<>
						{searchMeta && <span className='sv-search__meta'>{searchMeta}</span>}
						<button
							type='button'
							className='sv-search__clear'
							aria-label='Clear search'
							onClick={() => {
								onSearchChange('')
								searchInputRef.current?.focus()
							}}
						>
							<X className='h-[13px] w-[13px]' />
						</button>
					</>
				) : (
					<kbd className='sv-kbd'>/</kbd>
				)}
			</label>

			<div className='sv-toolbar__right' data-tauri-drag-region='false'>
				<div className='sv-seg' role='radiogroup' aria-label='Interaction mode'>
					<button
						type='button'
						role='radio'
						aria-checked={!editMode}
						className={cn(!editMode && 'is-active')}
						title='Read only: drag to pan (E)'
						onClick={() => onEditModeChange(false)}
					>
						<Hand className='h-3.5 w-3.5' />
						<span className='sv-seg__label'>View</span>
					</button>
					<button
						type='button'
						role='radio'
						aria-checked={editMode}
						className={cn(editMode && 'is-active')}
						title='Edit layout: drag tables (E)'
						onClick={() => onEditModeChange(true)}
					>
						<Move className='h-3.5 w-3.5' />
						<span className='sv-seg__label'>Arrange</span>
					</button>
				</div>
				<IconButton label='Minimap (M)' active={showMinimap} onClick={onToggleMinimap}>
					<MapIcon className='h-4 w-4' />
				</IconButton>
				<IconButton label='Fit view (F)' onClick={onFit}>
					<Maximize className='h-4 w-4' />
				</IconButton>
				<IconButton
					label={isLoading ? 'Reloading schema…' : 'Reload schema'}
					disabled={isLoading}
					onClick={onRefresh}
				>
					<RefreshCw className={cn('h-4 w-4', isLoading && 'sv-spin')} />
				</IconButton>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type='button'
							className='sv-ibtn'
							aria-label='Export schema'
							disabled={!canExport}
						>
							<Download className='h-4 w-4' />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-44 shadow-none'>
						<DropdownMenuItem onClick={onExportSvg}>Export SVG</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPng}>Export PNG</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onPreviewSql}>Export SQL</DropdownMenuItem>
						<DropdownMenuItem onClick={onPreviewDrizzle}>
							Export Drizzle
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onPreviewJson}>Export JSON</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<IconButton label='Details panel' active={showDetails} onClick={onToggleDetails}>
					<PanelRight className='h-4 w-4' />
				</IconButton>
				{rightSlot ? (
					<>
						<span className='sv-toolbar__divider' />
						{rightSlot}
					</>
				) : null}
			</div>
		</header>
	)
}
