import { RotateCcw } from 'lucide-react'
import { DEFAULT_SETTINGS, useSettings, type SettingsState } from '@studio/core/settings'
import { Button } from '@studio/shared/ui/button'
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
import { EditorPreview } from '../components/editor-preview'
import { SettingCard, SettingGroup, SettingRow } from '../components/setting-primitives'
import { useAppearanceSettings } from '../use-appearance'

const FONT_SIZE_LIMITS = { min: 10, max: 24 }

export function EditorScreen() {
	const { settings, updateSetting } = useSettings()
	const { settings: appearance } = useAppearanceSettings()
	const isDefault =
		settings.editorFontSize === DEFAULT_SETTINGS.editorFontSize &&
		settings.editorTheme === DEFAULT_SETTINGS.editorTheme &&
		settings.enableVimMode === DEFAULT_SETTINGS.enableVimMode

	function resetEditor() {
		updateSetting('editorFontSize', DEFAULT_SETTINGS.editorFontSize)
		updateSetting('editorTheme', DEFAULT_SETTINGS.editorTheme)
		updateSetting('enableVimMode', DEFAULT_SETTINGS.enableVimMode)
	}

	return (
		<>
			<SettingGroup label='Preview' help='Updates as you change the settings below.'>
				<EditorPreview
					fontSize={settings.editorFontSize}
					theme={settings.editorTheme}
					vim={settings.enableVimMode}
					appIsLight={appearance.theme === 'light'}
				/>
			</SettingGroup>

			<SettingGroup label='Text'>
				<SettingCard>
					<SettingRow
						focusId='editor-font-size'
						label='Font size'
						labelId='editor-font-size-label'
						help='Size of text in the SQL editor.'
					>
						<span className='text-[11px] text-muted-foreground'>A</span>
						<Slider
							aria-labelledby='editor-font-size-label'
							className='w-48'
							value={[settings.editorFontSize]}
							min={FONT_SIZE_LIMITS.min}
							max={FONT_SIZE_LIMITS.max}
							step={1}
							onValueChange={([value]) => updateSetting('editorFontSize', value)}
						/>
						<span className='text-[15px] leading-none text-muted-foreground'>A</span>
						<output className='min-w-11 text-right font-mono text-xs tabular-nums text-foreground'>
							{settings.editorFontSize}px
						</output>
					</SettingRow>

					<SettingRow
						focusId='editor-syntax-theme'
						label='Syntax theme'
						htmlFor='editor-syntax-theme-select'
						help='Colors used for SQL highlighting. Auto follows the app theme.'
					>
						<Select
							value={settings.editorTheme}
							onValueChange={(value) =>
								updateSetting('editorTheme', value as SettingsState['editorTheme'])
							}
						>
							<SelectTrigger
								id='editor-syntax-theme-select'
								className='h-8 w-56 text-xs'
							>
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
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Behavior'>
				<SettingCard>
					<SettingRow
						focusId='editor-vim-keybindings'
						label='Vim keybindings'
						labelId='editor-vim-label'
						help='Use Vim-style keyboard shortcuts'
					>
						<Switch
							aria-labelledby='editor-vim-label'
							checked={settings.enableVimMode}
							onCheckedChange={(checked) => updateSetting('enableVimMode', checked)}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<div className='mt-5 flex justify-end'>
				<Button
					variant='ghost'
					size='sm'
					disabled={isDefault}
					onClick={resetEditor}
					className='h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground'
				>
					<RotateCcw className='h-3.5 w-3.5' />
					Reset to defaults
				</Button>
			</div>
		</>
	)
}
