import { useQueryClient } from '@tanstack/react-query'
import {
	memo,
	useCallback,
	useRef,
	KeyboardEvent,
	type ReactNode,
	type SyntheticEvent
} from 'react'
import { preloadView } from './preload-views'
import { DoraLogo } from '@studio/components/dora-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { SidebarPanelToggle } from '@studio/features/sidebar/components/sidebar-panel-toggle'
import { SidebarProvider, useSidebar } from './context'
import { SidebarNavItem } from './nav-item'
import {
	AnalyticsIcon,
	DataViewerIcon,
	DockerIcon,
	KvStudioIcon,
	PerformanceIcon,
	SchemaDiffIcon,
	SchemaIcon,
	SettingsIcon,
	SqlConsoleIcon
} from './rail-icons'
import { useActiveIndicator } from './use-active-indicator'
import { UpdateIndicator } from '@studio/features/updater/update-indicator'
import type { NavItem, SidebarVariant } from './types'

type DatabasePanelToggle = {
	isOpen: boolean
	onToggle: () => void
}

const PanelToggle = memo(SidebarPanelToggle)

const SQL_CONSOLE_ITEM: NavItem = { id: 'sql-console', label: 'SQL Console', icon: SqlConsoleIcon }
const DATA_VIEWER_ITEM: NavItem = {
	id: 'database-studio',
	label: 'Data Viewer',
	icon: DataViewerIcon
}
const KV_ITEM: NavItem = { id: 'kv-studio', label: 'Redis / Valkey', icon: KvStudioIcon }
const ANALYTICS_ITEM: NavItem = { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon }
const SCHEMA_ITEM: NavItem = { id: 'schema-visualizer', label: 'Schema', icon: SchemaIcon }
const SCHEMA_DIFF_ITEM: NavItem = { id: 'orm-cockpit', label: 'Schema Diff', icon: SchemaDiffIcon }
const DOCKER_ITEM: NavItem = { id: 'docker', label: 'Docker Manager', icon: DockerIcon }
const PERFORMANCE_ITEM: NavItem = { id: 'performance', label: 'Performance', icon: PerformanceIcon }
const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: SettingsIcon }

const MAIN_NAV_ITEMS: NavItem[] = [
	SQL_CONSOLE_ITEM,
	DATA_VIEWER_ITEM,
	KV_ITEM,
	SCHEMA_ITEM,
	SCHEMA_DIFF_ITEM,
	DOCKER_ITEM,
	PERFORMANCE_ITEM
]

const MAIN_NAV_ITEMS_WITH_ANALYTICS: NavItem[] = [
	SQL_CONSOLE_ITEM,
	DATA_VIEWER_ITEM,
	KV_ITEM,
	ANALYTICS_ITEM,
	SCHEMA_ITEM,
	SCHEMA_DIFF_ITEM,
	DOCKER_ITEM,
	PERFORMANCE_ITEM
]

/**
 * @name getRailNavIds
 * @description Returns the icon rail's view ids in on-screen order, top to bottom, Settings last.
 * @example getRailNavIds(false)[0] // 'sql-console'
 */
export function getRailNavIds(analyticsAvailable: boolean) {
	const items = analyticsAvailable ? MAIN_NAV_ITEMS_WITH_ANALYTICS : MAIN_NAV_ITEMS
	return [...items, SETTINGS_ITEM].map(function (item) {
		return item.id
	})
}

const HomeButton = memo(function HomeButton({ onSelect }: { onSelect: (id: string) => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type='button'
					onClick={() => onSelect('database-studio')}
					className='cursor-pointer hover:opacity-80 transition-opacity focus-visible:opacity-80 focus-visible:bg-focus rounded-md'
					aria-label='Go to home'
					title='Dora AI Home'
				>
					<DoraLogo size={28} variant='neutral' />
				</button>
			</TooltipTrigger>
			<TooltipContent side='right'>Go to Home</TooltipContent>
		</Tooltip>
	)
})

type ContentProps = {
	activeNavId?: string
	onNavSelect?: (id: string) => void
	databasePanelToggle?: DatabasePanelToggle
	analyticsAvailable?: boolean
	aiAssistantToggle?: ReactNode
}

function SidebarContent({
	activeNavId,
	onNavSelect,
	databasePanelToggle,
	analyticsAvailable,
	aiAssistantToggle
}: ContentProps) {
	const { variant } = useSidebar()
	const isFloating = false
	const navRef = useRef<HTMLElement>(null)
	const indicatorRef = useActiveIndicator(navRef, activeNavId, analyticsAvailable)

	const mainNavItems = analyticsAvailable ? MAIN_NAV_ITEMS_WITH_ANALYTICS : MAIN_NAV_ITEMS
	const onNavSelectRef = useRef(onNavSelect)
	onNavSelectRef.current = onNavSelect
	const queryClient = useQueryClient()
	const handlePreload = useCallback(
		function (event: SyntheticEvent<HTMLElement>) {
			const id = event.currentTarget.dataset.navId
			if (id) preloadView(id, queryClient)
		},
		[queryClient]
	)
	const handleSelect = useCallback(function (id: string) {
		onNavSelectRef.current?.(id)
	}, [])

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
		const nav = navRef.current
		if (!nav) return

		const items = Array.from(
			nav.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
		)
		const currentIndex = items.findIndex((item) => item === document.activeElement)

		let nextIndex = currentIndex

		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault()
				nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
				break
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault()
				nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
				break
			case 'Home':
				event.preventDefault()
				nextIndex = 0
				break
			case 'End':
				event.preventDefault()
				nextIndex = items.length - 1
				break
		}

		if (nextIndex !== currentIndex && items[nextIndex]) {
			items[nextIndex].focus()
		}
	}, [])

	return (
		<aside
			className={cn(
				'flex h-full w-16 shrink-0 flex-col bg-sidebar',
				isFloating
					? 'm-3 rounded-2xl border border-sidebar-border shadow-lg'
					: 'border-r border-sidebar-border'
			)}
			style={isFloating ? { height: 'calc(100% - 24px)' } : undefined}
			role='complementary'
			aria-label='Main sidebar'
		>
			<div className='flex flex-col items-center justify-center pt-2 gap-4'>
				<HomeButton onSelect={handleSelect} />
				<div
					className='w-8 h-px bg-sidebar-border'
					role='separator'
					aria-orientation='horizontal'
				/>
			</div>
			{/* Main Navigation */}
			<nav
				ref={navRef}
				className='relative flex flex-1 flex-col gap-1 p-2'
				role='menubar'
				aria-label='Main navigation'
				onKeyDown={handleKeyDown}
			>
				<div ref={indicatorRef} className='rail-indicator' aria-hidden='true' />
				{/* Primary nav items */}
				<div
					role='group'
					aria-label='Primary features'
					className='mx-auto flex flex-col gap-1'
				>
					{mainNavItems.map((item) => (
						<SidebarNavItem
							key={item.id}
							item={item}
							isActive={activeNavId === item.id}
							onNavigate={handleSelect}
							variant={variant}
							onPointerEnter={handlePreload}
							onFocus={handlePreload}
						/>
					))}
				</div>

				<div
					role='group'
					aria-label='Workspace controls'
					className='mx-auto mt-auto flex flex-col items-center gap-1'
				>
					{aiAssistantToggle}
					<UpdateIndicator />
					{databasePanelToggle && (
						<>
							<PanelToggle
								isOpen={databasePanelToggle.isOpen}
								onToggle={databasePanelToggle.onToggle}
								buttonClassName='h-10 w-10 text-sidebar-foreground aria-pressed:bg-sidebar-accent aria-pressed:text-sidebar-accent-foreground'
								className='h-5 w-5'
								tooltipSide='right'
							/>
							<div
								className='w-8 h-px bg-sidebar-border'
								role='separator'
								aria-orientation='horizontal'
							/>
						</>
					)}
					<SidebarNavItem
						item={SETTINGS_ITEM}
						isActive={activeNavId === SETTINGS_ITEM.id}
						onNavigate={handleSelect}
						variant={variant}
					/>
				</div>
			</nav>
		</aside>
	)
}

export type AppSidebarProps = {
	variant?: SidebarVariant
	activeNavId?: string
	onNavSelect?: (id: string) => void
	databasePanelToggle?: DatabasePanelToggle
	analyticsAvailable?: boolean
	aiAssistantToggle?: ReactNode
}

export function NavigationSidebar({
	variant = 'default',
	activeNavId,
	onNavSelect,
	databasePanelToggle,
	analyticsAvailable,
	aiAssistantToggle
}: AppSidebarProps) {
	return (
		<SidebarProvider defaultVariant={variant}>
			<SidebarContent
				activeNavId={activeNavId}
				onNavSelect={onNavSelect}
				databasePanelToggle={databasePanelToggle}
				analyticsAvailable={analyticsAvailable}
				aiAssistantToggle={aiAssistantToggle}
			/>
		</SidebarProvider>
	)
}

// Export context hook for external use
export { useSidebar } from './context'
