import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSettings, type SettingsState } from '@/core/settings'
import {
	SHORTCUT_CATEGORIES,
	useEffectiveShortcuts,
	useShortcutStore
} from '@/core/shortcuts'
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
import { cn } from '@/shared/utils/cn'
import { AiKeysSection } from './ai-keys-section'
import { ShortcutRecorder } from './shortcut-recorder'
import { StorageSection } from './storage-section'

type SettingsSectionId =
	| 'editor'
	| 'shortcuts'
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
		id: 'ai-keys',
		title: 'AI Keys',
		description: 'Groq API keys and health checks'
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
				'group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
				active
					? 'border-primary/30 bg-primary/10 text-sidebar-foreground shadow-sm'
					: 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
			)}
		>
			<span
				className={cn(
					'mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition-colors',
					active ? 'bg-primary' : 'bg-sidebar-border group-hover:bg-primary/60'
				)}
			/>
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
			className='scroll-mt-6 rounded-2xl border border-sidebar-border bg-sidebar/35 p-4 shadow-sm'
		>
			<div className='mb-4'>
				<h2 className='text-sm font-semibold text-sidebar-foreground'>{title}</h2>
				<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>{description}</p>
			</div>
			{children}
		</section>
	)
}

export function SettingsView() {
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
			<aside className='flex w-[280px] max-w-[36vw] shrink-0 flex-col border-r border-sidebar-border bg-sidebar'>
				<div className='border-b border-sidebar-border px-4 py-3'>
					<div className='text-sm font-semibold text-sidebar-foreground'>Settings</div>
					<div className='mt-1 text-xs text-muted-foreground'>
						{sectionCount} sections organized like the table sidebar
					</div>
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto p-2'>
					<div className='space-y-1.5'>
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
				<div className='border-b border-border bg-sidebar/20 px-6 py-4'>
					<h1 className='text-base font-semibold text-sidebar-foreground'>
						Application settings
					</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						Manage editor behavior, shortcuts, AI keys, storage, and UI preferences
						without fighting a popover.
					</p>
				</div>

				<div className='min-h-0 flex-1 overflow-hidden'>
					<div className='h-full overflow-y-auto px-6 py-5'>
						<div className='space-y-5'>
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
																className='flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent/30'
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
								id='ai-keys'
								title='AI Keys'
								description='Store and verify Groq API keys used by the assistant.'
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
