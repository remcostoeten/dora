import { Copy } from 'lucide-react'
import { useSettings } from '@/core/settings'
import { Button } from '@/shared/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { SidebarPanel, SidebarPanelContent, SidebarSection } from './sidebar-panel'

type Props = {
	onCopySchema?: () => void
}

export function SettingsPanel({ onCopySchema }: Props) {
	const { settings, updateSetting } = useSettings()

	return (
		<SidebarPanel>
			<SidebarPanelContent>
				<div className='flex flex-col p-4'>
					<SidebarSection title='Editor'>
						<div className='space-y-2'>
							<div className='flex items-center justify-between'>
								<span className='text-sm text-sidebar-foreground'>Font size</span>
								<span className='text-sm font-mono text-sidebar-foreground'>
									{settings.editorFontSize}px
								</span>
							</div>
							<div className='flex items-center gap-3'>
								<span className='text-xs text-muted-foreground'>A</span>
								<Slider
									value={[settings.editorFontSize]}
									onValueChange={function ([value]) {
										updateSetting('editorFontSize', value)
									}}
									min={10}
									max={24}
									step={1}
								/>
								<span className='text-base text-muted-foreground'>A</span>
							</div>
						</div>

						<div className='space-y-2 pt-2'>
							<div className='text-sm text-sidebar-foreground'>Syntax theme</div>
							<Select
								value={settings.editorTheme}
								onValueChange={function (value) {
									updateSetting('editorTheme', value as any)
								}}
							>
								<SelectTrigger className='w-full h-8 text-xs'>
									<SelectValue placeholder='Select theme' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='auto'>Auto (System)</SelectItem>
									<SelectItem value='vs'>Light (Default)</SelectItem>
									<SelectItem value='vs-dark'>Dark (Default)</SelectItem>
									<SelectSeparator />
									<SelectItem value='dracula'>Dracula</SelectItem>
									<SelectItem value='nord'>Nord</SelectItem>
									<SelectItem value='monokai'>Monokai</SelectItem>
									<SelectItem value='github-dark'>GitHub Dark</SelectItem>
									<SelectItem value='github-light'>GitHub Light</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className='flex items-start justify-between gap-4 pt-2'>
							<div className='flex-1'>
								<div className='text-sm text-sidebar-foreground'>
									Vim keybindings
								</div>
								<div className='text-xs text-muted-foreground leading-tight'>
									Use Vim-style keyboard shortcuts
								</div>
							</div>
							<div className='flex-shrink-0 pt-0.5'>
								<Switch
									checked={settings.enableVimMode}
									onCheckedChange={function (checked) {
										updateSetting('enableVimMode', checked)
									}}
								/>
							</div>
						</div>
					</SidebarSection>

					<SidebarSection title='Safety'>
						<div className='flex items-start justify-between gap-4'>
							<div className='flex-1'>
								<div className='text-sm text-sidebar-foreground'>
									Confirm before delete
								</div>
								<div className='text-xs text-muted-foreground leading-tight'>
									Show confirmation for destructive actions
								</div>
							</div>
							<div className='flex-shrink-0 pt-0.5'>
								<Switch
									checked={settings.confirmBeforeDelete}
									onCheckedChange={(checked) =>
										updateSetting('confirmBeforeDelete', checked)
									}
								/>
							</div>
						</div>
					</SidebarSection>

					<SidebarSection title='Startup'>
						<div className='flex items-start justify-between gap-4'>
							<div className='flex-1'>
								<div className='text-sm text-sidebar-foreground'>
									Restore last connection
								</div>
								<div className='text-xs text-muted-foreground leading-tight'>
									Automatically reconnect to the last used database on startup
								</div>
							</div>
							<div className='flex-shrink-0 pt-0.5'>
								<Switch
									checked={settings.restoreLastConnection}
									onCheckedChange={(checked) =>
										updateSetting('restoreLastConnection', checked)
									}
								/>
							</div>
						</div>
					</SidebarSection>

					<SidebarSection title='Interface'>
						<div className='space-y-4'>
							<div className='flex items-start justify-between gap-4'>
								<div className='flex-1'>
									<div className='text-sm text-sidebar-foreground'>
										Selection Bar
									</div>
									<div className='text-xs text-muted-foreground leading-tight'>
										Choose the style of the row selection bar
									</div>
								</div>
								<div className='flex-shrink-0 pt-0.5 min-w-[120px]'>
									<Select
										value={settings.selectionBarStyle || 'floating'}
										onValueChange={(value) =>
											updateSetting(
												'selectionBarStyle',
												value as 'floating' | 'static'
											)
										}
									>
										<SelectTrigger className='w-full h-8 text-xs'>
											<SelectValue placeholder='Select style' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='floating'>Floating Pill</SelectItem>
											<SelectItem value='static'>Static Bar</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className='flex items-start justify-between gap-4'>
								<div className='flex-1'>
									<div className='text-sm text-sidebar-foreground'>
										Show Toasts
									</div>
									<div className='text-xs text-muted-foreground leading-tight'>
										Enable or disable toast notifications
									</div>
								</div>
								<div className='flex-shrink-0 pt-0.5'>
									<Switch
										checked={settings.showToasts !== false} // Default to true if undefined
										onCheckedChange={(checked) =>
											updateSetting('showToasts', checked)
										}
									/>
								</div>
							</div>
						</div>
					</SidebarSection>

					{onCopySchema && (
						<Button
							variant='outline'
							size='sm'
							className='justify-center gap-2 border-sidebar-border'
							onClick={onCopySchema}
						>
							<Copy className='h-4 w-4' />
							<span>Copy database schema</span>
						</Button>
					)}
				</div>
			</SidebarPanelContent>
		</SidebarPanel>
	)
}
