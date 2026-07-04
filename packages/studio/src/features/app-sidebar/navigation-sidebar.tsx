import { SquareTerminal, Table2, Container, Network, Settings, GitCompare, ChartLine } from 'lucide-react'
import { useCallback, useRef, KeyboardEvent } from 'react'
import { DoraLogo } from '@studio/components/dora-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { SidebarPanelToggle } from '@studio/features/sidebar/components/sidebar-panel-toggle'
import { SidebarProvider, useSidebar } from './context'
import { SidebarNavItem } from './nav-item'
import type { NavItem, SidebarVariant } from './types'

type DatabasePanelToggle = {
	isOpen: boolean
	onToggle: () => void
}

type ContentProps = {
	activeNavId?: string
	onNavSelect?: (id: string) => void
	databasePanelToggle?: DatabasePanelToggle
	analyticsAvailable?: boolean
}

function SidebarContent({
	activeNavId,
	onNavSelect,
	databasePanelToggle,
	analyticsAvailable
}: ContentProps) {
	const { variant } = useSidebar()
	const isFloating = false
	const navRef = useRef<HTMLElement>(null)

	// Nav items configuration
	const mainNavItems: NavItem[] = [
		{
			id: 'sql-console',
			label: 'SQL Console',
			icon: SquareTerminal,
			onClick: () => onNavSelect?.('sql-console')
		},
		{
			id: 'database-studio',
			label: 'Data Viewer',
			icon: Table2,
			onClick: () => onNavSelect?.('database-studio')
		},
		...(analyticsAvailable
			? [
					{
						id: 'analytics',
						label: 'Analytics',
						icon: ChartLine,
						onClick: () => onNavSelect?.('analytics')
					}
				]
			: []),
		{
			id: 'schema-visualizer',
			label: 'Schema',
			icon: Network,
			onClick: () => onNavSelect?.('schema-visualizer')
		},
		{
			id: 'orm-cockpit',
			label: 'Schema Diff',
			icon: GitCompare,
			onClick: () => onNavSelect?.('orm-cockpit')
		},
		{
			id: 'docker',
			label: 'Docker Manager',
			icon: Container,
			onClick: () => onNavSelect?.('docker')
		}
	]

	const settingsNavItem: NavItem = {
		id: 'settings',
		label: 'Settings',
		icon: Settings,
		onClick: () => onNavSelect?.('settings')
	}

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
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type='button'
							onClick={() => onNavSelect?.('database-studio')}
							className='cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar rounded-md'
							aria-label='Go to home'
							title='Dora AI Home'
						>
							<DoraLogo size={28} variant='neutral' />
						</button>
					</TooltipTrigger>
					<TooltipContent side='right'>Go to Home</TooltipContent>
				</Tooltip>
				<div
					className='w-8 h-px bg-sidebar-border'
					role='separator'
					aria-orientation='horizontal'
				/>
			</div>
			{/* Main Navigation */}
			<nav
				ref={navRef}
				className='flex flex-1 flex-col gap-1 p-2'
				role='menubar'
				aria-label='Main navigation'
				onKeyDown={handleKeyDown}
			>
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
							variant={variant}
						/>
					))}
				</div>

				<div role='group' aria-label='Settings' className='mx-auto mt-auto flex flex-col items-center gap-1'>
					{databasePanelToggle && (
						<>
							<SidebarPanelToggle
								isOpen={databasePanelToggle.isOpen}
								onToggle={databasePanelToggle.onToggle}
								buttonClassName='h-10 w-10'
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
						item={settingsNavItem}
						isActive={activeNavId === settingsNavItem.id}
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
}

export function NavigationSidebar({
	variant = 'default',
	activeNavId,
	onNavSelect,
	databasePanelToggle,
	analyticsAvailable
}: AppSidebarProps) {
	return (
		<SidebarProvider defaultVariant={variant}>
			<SidebarContent
				activeNavId={activeNavId}
				onNavSelect={onNavSelect}
				databasePanelToggle={databasePanelToggle}
				analyticsAvailable={analyticsAvailable}
			/>
		</SidebarProvider>
	)
}

// Export context hook for external use
export { useSidebar } from './context'
