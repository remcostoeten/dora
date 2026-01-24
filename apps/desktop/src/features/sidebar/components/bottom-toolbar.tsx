import { Settings, Monitor, Sparkles, Info } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { CURRENT_VERSION } from '../changelog-data'
import { AppearancePanel } from './appearance-panel'
import { ChangelogPanel } from './changelog-panel'
import { ProjectInfoPanel } from './project-info-panel'
import { SettingsPanel } from './settings-panel'

type Theme = 'dark' | 'light' | 'midnight' | 'forest' | 'claude' | 'claude-dark' | 'haptic'

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
	{ id: 'theme', icon: Monitor, label: 'Appearance' }
]

type Props = {
	onAction: (action: ToolbarAction) => void
	onCopySchema?: () => void
	themeProps?: {
		theme: Theme
		onThemeChange: (theme: Theme) => void
	}
}

export function BottomToolbar({ onAction, onCopySchema, themeProps }: Props) {
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
						<Popover key={item.id}>
							<PopoverTrigger asChild>
								<div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												className='h-6 w-auto px-1.5 gap-1 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
											>
												<item.icon className='h-4 w-4' />
												<Badge
													variant='outline'
													className='text-[9px] px-1 py-0 h-4 font-mono border-muted-foreground/30'
												>
													v{CURRENT_VERSION}
												</Badge>
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
								<SettingsPanel onCopySchema={onCopySchema} />
							</PopoverContent>
						</Popover>
					)
				}

				if (item.id === 'theme') {
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
