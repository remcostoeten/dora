import {
	SquareTerminal,
	Table2,
	Network,
	Container,
	Sparkles
} from 'lucide-react'
import { useCallback, useRef, KeyboardEvent } from 'react'
import { DoraLogo } from '@/components/dora-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/shared/utils/cn'
import { SidebarProvider, useSidebar } from './context'
import { SidebarNavItem } from './nav-item'
import type { NavItem, SidebarVariant } from './types'

type ContentProps = {
	activeNavId?: string
	onNavSelect?: (id: string) => void
}

function SidebarContent({ activeNavId, onNavSelect }: ContentProps) {
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
		}
	]

	const secondaryNavItems: NavItem[] = [
		{
			id: 'docker',
			label: 'Docker Manager',
			icon: Container,
			onClick: () => onNavSelect?.('docker')
		}
	]

	const comingSoonItems: NavItem[] = [
		{
			id: 'dora',
			label: 'Dora AI Assistant',
			icon: Sparkles,
			disabled: true
		},
		{
			id: 'schema',
			label: 'Schema Visualizer',
			icon: Network,
			disabled: true
		}
	]

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
				'flex h-full w-16 flex-col bg-sidebar',
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

				{/* Separator */}
				<div
					className='my-2 mx-2 h-px bg-sidebar-border'
					role='separator'
					aria-orientation='horizontal'
				/>

				<div
					role='group'
					aria-label='Tools'
					className='mx-auto flex flex-col gap-1'
				>
					{secondaryNavItems.map((item) => (
						<SidebarNavItem
							key={item.id}
							item={item}
							isActive={activeNavId === item.id}
							variant={variant}
						/>
					))}
				</div>

				<div
					className='my-2 mx-2 h-px bg-sidebar-border'
					role='separator'
					aria-orientation='horizontal'
				/>

				{/* Coming soon items */}
				<div
					role='group'
					aria-label='Coming soon features'
					className='mx-auto flex flex-col gap-1'
				>
					{comingSoonItems.map((item) => (
						<SidebarNavItem key={item.id} item={item} variant={variant} />
					))}
				</div>
			</nav>

			{/* Footer */}
			<div
				className={cn(
					'flex flex-col items-center justify-center gap-1 py-2',
					!isFloating && 'border-t border-sidebar-border'
				)}
				role='group'
				aria-label='Sidebar controls'
			/>
		</aside>
	)
}

export type AppSidebarProps = {
	variant?: SidebarVariant
	activeNavId?: string
	onNavSelect?: (id: string) => void
}

export function NavigationSidebar({
	variant = 'default',
	activeNavId,
	onNavSelect
}: AppSidebarProps) {
	return (
		<SidebarProvider defaultVariant={variant}>
			<SidebarContent activeNavId={activeNavId} onNavSelect={onNavSelect} />
		</SidebarProvider>
	)
}

// Export context hook for external use
export { useSidebar } from './context'
