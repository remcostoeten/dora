import { Settings, Sun, Moon, Sparkles, Info, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
	getAppearanceSettings,
	saveAppearanceSettings,
	applyAppearanceToDOM
} from '@/shared/lib/appearance-store'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { CURRENT_VERSION } from '../changelog-data'
import { AppearancePanel } from './appearance-panel'
import { ChangelogPanel } from './changelog-panel'
import { ProjectInfoPanel } from './project-info-panel'
import { SettingsPanel } from './settings-panel'

type Theme = 'dark' | 'light' | 'midnight' | 'forest' | 'claude' | 'claude-dark' | 'night'

const LIGHT_THEMES: Theme[] = ['light', 'claude']

type ToolbarAction = 'settings' | 'theme' | 'changelog' | 'project-info'

type ToolbarItem = {
	id: ToolbarAction
	icon: React.ComponentType<{ className?: string }>
	label: string
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
	{ id: 'project-info', icon: Info, label: 'Project Info' },
	{ id: 'changelog', icon: Sparkles, label: "What's new" },
	{ id: 'settings', icon: Settings, label: 'Settings' },
	{ id: 'theme', icon: Sun, label: 'Appearance' }
]

type Props = {
	onAction?: (action: ToolbarAction) => void
	themeProps?: {
		theme: Theme
		onThemeChange: (theme: Theme) => void
	}
}

function useCurrentTheme() {
	const [theme, setTheme] = useState<Theme>(getAppearanceSettings().theme)

	useEffect(function listenForThemeChanges() {
		function handler(e: Event) {
			const detail = (e as CustomEvent).detail
			if (detail?.theme) setTheme(detail.theme)
		}
		window.addEventListener('dora-appearance-change', handler)
		return function () {
			window.removeEventListener('dora-appearance-change', handler)
		}
	}, [])

	return theme
}

export function BottomToolbar({ onAction, themeProps }: Props) {
	const currentTheme = useCurrentTheme()
	const isLight = LIGHT_THEMES.includes(currentTheme)
	const [changelogOpen, setChangelogOpen] = useState(false)
	const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false)

	useEffect(function checkUnseenChangelog() {
		const lastSeenVersion = localStorage.getItem('dora.changelog.lastSeenVersion')
		setHasUnseenChangelog(lastSeenVersion !== CURRENT_VERSION)
	}, [])

	useEffect(
		function markChangelogAsSeenWhenOpened() {
			if (!changelogOpen) return
			localStorage.setItem('dora.changelog.lastSeenVersion', CURRENT_VERSION)
			setHasUnseenChangelog(false)
		},
		[changelogOpen]
	)

	function toggleLightDark() {
		const next: Theme = isLight ? 'dark' : 'light'
		const updated = saveAppearanceSettings({ theme: next })
		applyAppearanceToDOM(updated)
	}

	return (
		<div className='flex items-center justify-around px-2 h-8 border-t border-sidebar-border mt-auto'>
			{TOOLBAR_ITEMS.map(function (item) {
				if (item.id === 'project-info') {
					return (
						<Popover key={item.id}>
							<PopoverTrigger asChild>
								<div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
											>
												<item.icon className='h-4 w-4' />
											</Button>
										</TooltipTrigger>
										<TooltipContent side='top' className='text-xs'>
											{item.label}
										</TooltipContent>
									</Tooltip>
								</div>
							</PopoverTrigger>
							<PopoverContent
								side='right'
								align='end'
								sideOffset={16}
								className='w-[340px] p-0 mb-2 ml-2'
							>
								<ProjectInfoPanel />
							</PopoverContent>
						</Popover>
					)
				}

				if (item.id === 'changelog') {
					return (
						<Popover key={item.id} open={changelogOpen} onOpenChange={setChangelogOpen}>
							<PopoverTrigger asChild>
								<div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												className='relative h-6 w-auto px-1.5 gap-1 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
											>
												<item.icon className='h-4 w-4' />
												<Badge
													variant='outline'
													className='text-[9px] px-1 py-0 h-4 font-mono border-muted-foreground/30'
												>
													v{CURRENT_VERSION}
												</Badge>
												{hasUnseenChangelog && (
													<span className='absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary' />
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent side='top' className='text-xs'>
											{item.label}
										</TooltipContent>
									</Tooltip>
								</div>
							</PopoverTrigger>
							<PopoverContent
								side='right'
								align='end'
								sideOffset={16}
								className='w-[340px] p-0 mb-2 ml-2 max-h-[600px]'
							>
								<ChangelogPanel />
							</PopoverContent>
						</Popover>
					)
				}

				if (item.id === 'settings') {
					return (
						<Popover key={item.id}>
							<PopoverTrigger asChild>
								<div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
											>
												<item.icon className='h-4 w-4' />
											</Button>
										</TooltipTrigger>
										<TooltipContent side='top' className='text-xs'>
											{item.label}
										</TooltipContent>
									</Tooltip>
								</div>
							</PopoverTrigger>
							<PopoverContent
								side='right'
								align='end'
								sideOffset={16}
								className='w-[360px] p-0 mb-2 ml-2'
							>
								<SettingsPanel />
							</PopoverContent>
						</Popover>
					)
				}

				if (item.id === 'theme') {
					return (
						<Popover key={item.id}>
							<div className='group/theme relative flex items-center'>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant='ghost'
											size='icon'
											className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
											onClick={toggleLightDark}
										>
											{isLight ? (
												<Moon className='h-4 w-4' />
											) : (
												<Sun className='h-4 w-4' />
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent side='top' className='text-xs'>
										{isLight ? 'Switch to dark' : 'Switch to light'}
									</TooltipContent>
								</Tooltip>
								<PopoverTrigger asChild>
									<button
										className='absolute -right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-sidebar-accent border border-sidebar-border text-muted-foreground opacity-0 scale-75 group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-150 hover:text-sidebar-foreground hover:bg-muted'
										aria-label='All themes'
									>
										<ChevronRight className='h-2.5 w-2.5' />
									</button>
								</PopoverTrigger>
							</div>
							<PopoverContent
								side='right'
								align='end'
								sideOffset={20}
								className='w-[520px] p-0 mb-2 ml-2'
							>
								<AppearancePanel />
							</PopoverContent>
						</Popover>
					)
				}

				return (
					<Tooltip key={item.id}>
						<TooltipTrigger asChild>
							<Button
								variant='ghost'
								size='icon'
								className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
								onClick={function () {
									onAction(item.id)
								}}
							>
								<item.icon className='h-4 w-4' />
							</Button>
						</TooltipTrigger>
						<TooltipContent side='top' className='text-xs'>
							{item.label}
						</TooltipContent>
					</Tooltip>
				)
			})}
		</div>
	)
}

export type { ToolbarAction, Theme }
