import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSettings, type SettingsState } from '@studio/core/settings'
import {
	SHORTCUT_CATEGORIES,
	useEffectiveShortcuts,
	useShortcutStore
} from '@studio/core/shortcuts'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { Slider } from '@studio/shared/ui/slider'
import { Switch } from '@studio/shared/ui/switch'
import { cn } from '@studio/shared/utils/cn'
import { AiProviderSection } from '@studio/features/ai-assistant/ai-provider-section'
import { AiKeysSection } from './ai-keys-section'
import { ShortcutRecorder } from './shortcut-recorder'
import { StorageSection } from './storage-section'

type SettingsViewProps = {
	windowControls?: ReactNode
}

type SettingsSectionId =
	| 'editor'
	| 'shortcuts'
	| 'ai-provider'
	| 'ai-keys'
	| 'storage'
	| 'safety'
	| 'startup'
	| 'interface'

type SettingsSectionNav = {
	id: SettingsSectionId
	title: string
	description: string
}

const SETTINGS_SECTIONS: SettingsSectionNav[] = [
	{
		id: 'editor',
		title: 'Editor',
		description: 'Font size, syntax theme, and Vim mode'
	},
	{
		id: 'shortcuts',
		title: 'Shortcuts',
		description: 'Keyboard bindings and overrides'
	},
	{
		id: 'ai-provider',
		title: 'AI Provider',
		description: 'Active model provider and defaults'
	},
	{
		id: 'ai-keys',
		title: 'AI Keys',
		description: 'Encrypted API keys per provider'
	},
	{
		id: 'storage',
		title: 'Storage',
		description: 'Database locations and switching'
	},
	{
		id: 'safety',
		title: 'Safety',
		description: 'Destructive action confirmations'
	},
	{
		id: 'startup',
		title: 'Startup',
		description: 'Default connection behavior'
	},
	{
		id: 'interface',
		title: 'Interface',
		description: 'Selection bar and toast behavior'
	}
]

function SettingsNavButton({
	section,
	active,
	onClick
}: {
	section: SettingsSectionNav
	active: boolean
	onClick: () => void
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'group flex w-full items-start border-l-2 px-3 py-2 text-left transition-colors',
				active
					? 'border-sidebar-primary bg-sidebar-accent/60 text-sidebar-foreground'
					: 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/35 hover:text-sidebar-foreground'
			)}
		>
			<span className='min-w-0'>
				<span className='block text-sm font-medium'>{section.title}</span>
				<span className='mt-0.5 block text-[11px] leading-tight text-muted-foreground'>
					{section.description}
				</span>
			</span>
		</button>
	)
}

function SectionCard({
	id,
	title,
	description,
	children,
	sectionRef
}: {
	id: SettingsSectionId
	title: string
	description: string
	children: ReactNode
	sectionRef?: (node: HTMLElement | null) => void
}) {
	return (
		<section
			id={id}
			ref={sectionRef}
			className='scroll-mt-0 border-b border-sidebar-border px-5 py-4 last:border-b-0'
		>
			<div className='mb-4 flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-sm font-semibold text-sidebar-foreground'>{title}</h2>
					<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
						{description}
					</p>
				</div>
			</div>
			{children}
		</section>
	)
}

export function SettingsView({ windowControls }: SettingsViewProps = {}) {
	const { settings, updateSetting } = useSettings()
	const { setShortcut, resetShortcut, overrides } = useShortcutStore()
	const effectiveShortcuts = useEffectiveShortcuts()
	const [activeSection, setActiveSection] = useState<SettingsSectionId>('editor')
	const sectionRefs = useRef<Partial<Record<SettingsSectionId, HTMLElement | null>>>({})

	const sectionCount = useMemo(() => SETTINGS_SECTIONS.length, [])

	useEffect(
		function scrollActiveSectionIntoView() {
			sectionRefs.current[activeSection]?.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			})
		},
		[activeSection]
	)

	function registerSectionRef(id: SettingsSectionId) {
		return function (node: HTMLElement | null) {
			sectionRefs.current[id] = node
		}
	}

	return (
		<div className='flex h-full min-h-0 overflow-hidden bg-background'>
			<aside className='flex w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar'>
				<div className='flex h-16 flex-col justify-center border-b border-sidebar-border px-3'>
					<div className='text-sm font-semibold text-sidebar-foreground'>Settings</div>
					<div className='mt-0.5 text-xs text-muted-foreground'>
						{sectionCount} sections
					</div>
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto py-2'>
					<div>
						{SETTINGS_SECTIONS.map(function (section) {
							return (
								<SettingsNavButton
									key={section.id}
									section={section}
									active={activeSection === section.id}
									onClick={function () {
										setActiveSection(section.id)
									}}
								/>
							)
						})}
					</div>
				</div>
			</aside>

			<main className='flex min-w-0 flex-1 flex-col min-h-0'>
				<div
					className='flex h-16 items-center justify-between gap-4 border-b border-border bg-sidebar/20 px-5'
					data-tauri-drag-region='true'
				>
					<div className='min-w-0'>
						<h1 className='text-base font-semibold text-sidebar-foreground'>
							Application settings
						</h1>
						<p className='mt-0.5 text-xs text-muted-foreground'>
							Editor behavior, shortcuts, AI keys, storage, and interface preferences
						</p>
					</div>
					{windowControls ? (
						<div className='shrink-0' data-tauri-drag-region='false'>
							{windowControls}
						</div>
					) : null}
				</div>

				<div className='min-h-0 flex-1 overflow-hidden'>
					<div className='h-full overflow-y-auto'>
						<div>
							<SectionCard
								id='editor'
								title='Editor'
								description='Control editor typography, syntax highlighting, and Vim mode.'
								sectionRef={registerSectionRef('editor')}
							>
								<div className='space-y-4'>
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

									<div className='space-y-2'>
										<div className='text-sm text-sidebar-foreground'>Syntax theme</div>
										<Select
											value={settings.editorTheme}
											onValueChange={function (value) {
												updateSetting(
													'editorTheme',
													value as SettingsState['editorTheme']
												)
											}}
										>
											<SelectTrigger className='h-8 w-full text-xs'>
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

									<div className='flex items-start justify-between gap-4'>
										<div className='flex-1'>
											<div className='text-sm text-sidebar-foreground'>
												Vim keybindings
											</div>
											<div className='text-xs leading-tight text-muted-foreground'>
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
								</div>
							</SectionCard>

							<SectionCard
								id='shortcuts'
								title='Shortcuts'
								description='View and edit the keyboard bindings that control the app.'
								sectionRef={registerSectionRef('shortcuts')}
							>
								<div className='space-y-4'>
									{Object.entries(SHORTCUT_CATEGORIES).map(function ([category, names]) {
										return (
											<div key={category} className='space-y-2'>
												<div className='px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground'>
													{category}
												</div>
												<div className='space-y-1'>
													{names.map(function (name) {
														const def = effectiveShortcuts[name]
														if (!def) return null
														const isDefault = !overrides[name]
														return (
															<div
																key={name}
																className='flex items-center justify-between gap-4 rounded-sm px-2 py-1.5 transition-colors hover:bg-sidebar-accent/30'
															>
																<div className='min-w-0 flex-1'>
																	<div className='truncate text-sm text-sidebar-foreground'>
																		{def.description}
																	</div>
																	{!isDefault && (
																		<div className='text-[10px] text-muted-foreground'>
																			customized
																		</div>
																	)}
																</div>
																<ShortcutRecorder
																	value={def.combo}
																	onChange={function (newCombo) {
																		setShortcut(name, newCombo)
																	}}
																	onReset={function () {
																		resetShortcut(name)
																	}}
																	isDefault={isDefault}
																/>
															</div>
														)
													})}
												</div>
											</div>
										)
									})}
								</div>
							</SectionCard>

							<SectionCard
								id='ai-provider'
								title='AI Provider'
								description='Choose the active provider and model used by the assistant.'
								sectionRef={registerSectionRef('ai-provider')}
							>
								<AiProviderSection />
							</SectionCard>

							<SectionCard
								id='ai-keys'
								title='AI Keys'
								description='Store and verify encrypted API keys.'
								sectionRef={registerSectionRef('ai-keys')}
							>
								<AiKeysSection />
							</SectionCard>

							<SectionCard
								id='storage'
								title='Storage'
								description='Inspect and switch local database storage targets.'
								sectionRef={registerSectionRef('storage')}
							>
								<StorageSection />
							</SectionCard>

							<SectionCard
								id='safety'
								title='Safety'
								description='Control confirmation prompts for destructive actions.'
								sectionRef={registerSectionRef('safety')}
							>
								<div className='flex items-start justify-between gap-4'>
									<div className='flex-1'>
										<div className='text-sm text-sidebar-foreground'>
											Confirm before delete
										</div>
										<div className='text-xs leading-tight text-muted-foreground'>
											Show confirmation for destructive actions
										</div>
									</div>
									<div className='flex-shrink-0 pt-0.5'>
										<Switch
											checked={settings.confirmBeforeDelete}
											onCheckedChange={function (checked) {
												updateSetting('confirmBeforeDelete', checked)
											}}
										/>
									</div>
								</div>
							</SectionCard>

							<SectionCard
								id='startup'
								title='Startup'
								description='Choose how the app behaves when it launches.'
								sectionRef={registerSectionRef('startup')}
							>
								<div className='space-y-2'>
									<div className='flex-1'>
										<div className='text-sm text-sidebar-foreground'>
											Connection behavior
										</div>
										<div className='text-xs leading-tight text-muted-foreground'>
											Auto-connect to the last used database, or start on an empty view
										</div>
									</div>
									<div className='min-w-[160px] flex-shrink-0 pt-0.5'>
										<Select
											value={settings.startupConnectionMode || 'auto'}
											onValueChange={function (value) {
												const mode = value as 'auto' | 'empty'
												updateSetting('startupConnectionMode', mode)
												updateSetting('restoreLastConnection', mode === 'auto')
											}}
										>
											<SelectTrigger className='h-8 w-full text-xs'>
												<SelectValue placeholder='Select startup mode' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='auto'>Auto-connect</SelectItem>
												<SelectItem value='empty'>Start empty</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</SectionCard>

							<SectionCard
								id='interface'
								title='Interface'
								description='Tune row selection and toast behavior.'
								sectionRef={registerSectionRef('interface')}
							>
								<div className='space-y-4'>
									<div className='flex items-start justify-between gap-4'>
										<div className='flex-1'>
											<div className='text-sm text-sidebar-foreground'>
												Selection Bar
											</div>
											<div className='text-xs leading-tight text-muted-foreground'>
												Choose the style of the row selection bar
											</div>
										</div>
										<div className='min-w-[120px] flex-shrink-0 pt-0.5'>
											<Select
												value={settings.selectionBarStyle || 'floating'}
												onValueChange={function (value) {
													updateSetting(
														'selectionBarStyle',
														value as SettingsState['selectionBarStyle']
													)
												}}
											>
												<SelectTrigger className='h-8 w-full text-xs'>
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
											<div className='text-xs leading-tight text-muted-foreground'>
												Enable or disable toast notifications
											</div>
										</div>
										<div className='flex-shrink-0 pt-0.5'>
											<Switch
												checked={settings.showToasts !== false}
												onCheckedChange={function (checked) {
													updateSetting('showToasts', checked)
												}}
											/>
										</div>
									</div>
								</div>
							</SectionCard>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

export const SettingsPanel = SettingsView
