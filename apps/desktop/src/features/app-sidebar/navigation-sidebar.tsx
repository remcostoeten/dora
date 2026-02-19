import {
	Sparkles,
	SquareTerminal,
	Table2,
	Network,
	Container,
	SunMedium,
	MoonStar,
	ChevronRight,
	Settings
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react'
import { DoraLogo } from '@/components/dora-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/popover'
import {
	type Theme,
	applyAppearanceToDOM,
	getAppearanceSettings,
	saveAppearanceSettings
} from '@/shared/lib/appearance-store'
import { cn } from '@/shared/utils/cn'
import { AppearancePanel } from '@/features/sidebar/components/appearance-panel'
import { ChangelogPanel } from '@/features/sidebar/components/changelog-panel'
import { SettingsPanel } from '@/features/sidebar/components/settings-panel'
import { CURRENT_VERSION } from '@/features/sidebar/changelog-data'
import { SidebarProvider, useSidebar } from './context'
import { SidebarNavItem } from './nav-item'
import type { NavItem, SidebarVariant } from './types'


const LIGHT_THEMES: Theme[] = ['light', 'claude']

type TTogle = {
	variant: SidebarVariant
}

function ThemeToggle({ variant }: TTogle) {
	const [mounted, setMounted] = useState(false)
	const [currentTheme, setCurrentTheme] = useState<Theme>('dark')

	useEffect(function init() {
		setMounted(true)
		setCurrentTheme(getAppearanceSettings().theme)
	}, [])

	useEffect(function listenForThemeChanges() {
		function handler(e: Event) {
			const detail = (e as CustomEvent).detail
			if (detail?.theme) setCurrentTheme(detail.theme)
		}
		window.addEventListener('dora-appearance-change', handler)
		return function () {
			window.removeEventListener('dora-appearance-change', handler)
		}
	}, [])

	const isLight = LIGHT_THEMES.includes(currentTheme)

	const toggleTheme = useCallback(function () {
		const next: Theme = isLight ? 'dark' : 'light'
		const updated = saveAppearanceSettings({ theme: next })
		applyAppearanceToDOM(updated)
	}, [isLight])

	if (!mounted) return null

	return (
		<Popover>
			<div className='group/theme relative flex items-center justify-center'>
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
							aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
						>
							{isLight ? (
								<MoonStar className='h-5 w-5' aria-hidden='true' />
							) : (
								<SunMedium className='h-5 w-5' aria-hidden='true' />
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent side='right'>
						{isLight ? 'Dark Mode' : 'Light Mode'}
					</TooltipContent>
				</Tooltip>
				<PopoverTrigger asChild>
					<button
						className='absolute -right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sidebar-accent border border-sidebar-border text-muted-foreground opacity-0 scale-75 group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-150 hover:text-sidebar-foreground hover:bg-muted z-10'
						aria-label='All themes'
					>
						<ChevronRight className='h-2 w-2' />
					</button>
				</PopoverTrigger>
			</div>
			<PopoverContent
				side='right'
				align='end'
				sideOffset={16}
				className='w-[520px] p-0 mb-2 ml-2'
			>
				<AppearancePanel />
			</PopoverContent>
		</Popover>
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
					'flex flex-col items-center justify-center gap-1 py-2',
					!isFloating && 'border-t border-sidebar-border'
				)}
				role='group'
				aria-label='Sidebar controls'
			>
				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<button
									type='button'
									className='flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors'
									aria-label="What's new"
								>
									<Sparkles className='h-4 w-4' />
								</button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent side='right'>What's new (v{CURRENT_VERSION})</TooltipContent>
					</Tooltip>
					<PopoverContent
						side='right'
						align='end'
						sideOffset={16}
						className='w-[340px] p-0 mb-2 ml-2 h-[500px]'
					>
						<ChangelogPanel />
					</PopoverContent>
				</Popover>

				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<button
									type='button'
									className='flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors'
									aria-label='Settings'
								>
									<Settings className='h-4 w-4' />
								</button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent side='right'>Settings</TooltipContent>
					</Tooltip>
					<PopoverContent
						side='right'
						align='end'
						sideOffset={16}
						className='w-[360px] p-0 mb-2 ml-2'
					>
						<SettingsPanel />
					</PopoverContent>
				</Popover>

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
