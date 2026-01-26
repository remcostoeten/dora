import {
	Sparkles,
	SquareTerminal,
	Table2,
	Network,
	Container,
	SunMedium,
	MoonStar
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react'
import { DoraLogo } from '@/components/dora-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	applyAppearanceToDOM,
	getAppearanceSettings,
	saveAppearanceSettings
} from '@/shared/lib/appearance-store'
import { cn } from '@/shared/utils/cn'
import { SidebarProvider, useSidebar } from './context'
import { SidebarNavItem } from './nav-item'
import type { NavItem, SidebarVariant } from './types'

type TTogle = {
	variant: SidebarVariant
}

function ThemeToggle({ variant }: TTogle) {
	const [mounted, setMounted] = useState(false)
	const [isDark, setIsDark] = useState(true)

	useEffect(() => {
		setMounted(true)
		const settings = getAppearanceSettings()
		setIsDark(
			settings.theme === 'dark' ||
			settings.theme === 'midnight' ||
			settings.theme === 'forest' ||
			settings.theme === 'claude-dark'
		)
	}, [])

	const toggleTheme = useCallback(() => {
		const newTheme = isDark ? 'light' : 'dark'
		const newSettings = saveAppearanceSettings({ theme: newTheme })
		applyAppearanceToDOM(newSettings)
		setIsDark(!isDark)
	}, [isDark])

	if (!mounted) return null

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type='button'
					onClick={toggleTheme}
					className={cn(
						'flex h-8 w-8 items-center justify-center transition-colors',
						'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
						variant === 'floating' ? 'rounded-xl' : 'rounded-md'
					)}
					aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
					aria-pressed={isDark}
				>
					{isDark ? (
						<SunMedium className='h-5 w-5' aria-hidden='true' />
					) : (
						<MoonStar className='h-5 w-5' aria-hidden='true' />
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side='right'>{isDark ? 'Light Mode' : 'Dark Mode'}</TooltipContent>
		</Tooltip>
	)
}



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

	const comingSoonItems: NavItem[] = [
		{
			id: 'dora',
			label: 'Dora AI Assistant',
			icon: Sparkles,
			disabled: true,
			onClick: () => onNavSelect?.('dora')
		},
		{
			id: 'schema',
			label: 'Schema Visualizer',
			icon: Network,
			disabled: true
		},
		{
			id: 'docker',
			label: 'Docker Manager',
			icon: Container,
			onClick: () => onNavSelect?.('docker')
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

				{/* Coming Soon Items */}
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
					'flex h-10 items-center justify-center gap-1',
					!isFloating && 'border-t border-sidebar-border'
				)}
				role='group'
				aria-label='Sidebar controls'
			>

				<ThemeToggle variant={variant} />
			</div>
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
