import { Info, Sun, Moon, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
	getAppearanceSettings,
	saveAppearanceSettings,
	applyAppearanceToDOM,
	type Theme
} from '@/shared/lib/appearance-store'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { AppearancePanel } from './appearance-panel'
import { ProjectInfoPanel } from './project-info-panel'

type ToolbarAction = 'project-info' | 'theme'

type ToolbarItem = {
	id: ToolbarAction
	icon: React.ComponentType<{ className?: string }>
	label: string
}

const LIGHT_THEMES: Theme[] = ['light', 'claude']

const TOOLBAR_ITEMS: ToolbarItem[] = [
	{ id: 'project-info', icon: Info, label: 'Project Info' },
	{ id: 'theme', icon: Sun, label: 'Appearance' }
]

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


type Props = {
	onAction?: (action: ToolbarAction) => void
}

export function BottomToolbar({ onAction }: Props) {
	const currentTheme = useCurrentTheme()
	const isLight = LIGHT_THEMES.includes(currentTheme)

	function toggleLightDark() {
		const next: Theme = isLight ? 'dark' : 'light'
		const updated = saveAppearanceSettings({ theme: next })
		applyAppearanceToDOM(updated)
	}

	return (
		<div className='flex items-center justify-end px-2 h-8 border-t border-sidebar-border mt-auto gap-1'>
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
										className='absolute -left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-sidebar-accent border border-sidebar-border text-muted-foreground opacity-0 scale-75 group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-150 hover:text-sidebar-foreground hover:bg-muted z-10'
										aria-label='All themes'
									>
										<ChevronRight className='h-2.5 w-2.5 rotate-180' />
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

				return null
			})}
		</div>
	)
}

export type { ToolbarAction, Theme }
