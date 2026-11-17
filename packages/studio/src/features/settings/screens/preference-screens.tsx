import { useSettings, type SettingsState } from '@studio/core/settings'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { Switch } from '@studio/shared/ui/switch'
import {
	SegmentedControl,
	SettingCard,
	SettingGroup,
	SettingRow
} from '../components/setting-primitives'

export function SafetyScreen() {
	const { settings, updateSetting } = useSettings()
	return (
		<>
			<SettingGroup label='Confirmations'>
				<SettingCard>
					<SettingRow
						focusId='safety-confirm-before-delete'
						label='Confirm before delete'
						labelId='safety-confirm-label'
						help='Show confirmation for destructive actions'
					>
						<Switch
							aria-labelledby='safety-confirm-label'
							checked={settings.confirmBeforeDelete}
							onCheckedChange={(checked) =>
								updateSetting('confirmBeforeDelete', checked)
							}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Privacy'>
				<SettingCard>
					<SettingRow
						focusId='safety-privacy-mask'
						label='Privacy mode'
						labelId='safety-privacy-label'
						help="Hide all cell values in tables and query results with ••••••. Tables, columns, and queries stay visible; data becomes read-only and can't be copied or exported."
					>
						<Switch
							aria-labelledby='safety-privacy-label'
							checked={settings.privacyMaskData}
							onCheckedChange={(checked) => updateSetting('privacyMaskData', checked)}
						/>
					</SettingRow>
					<SettingRow
						focusId='safety-persist-snapshots'
						label='Remember table contents'
						labelId='safety-snapshots-label'
						help='Cache the last viewed page of each table on this device so tables reappear instantly after a restart. Row values are stored in plain text; turning this off (or enabling Privacy mode) removes the cache.'
					>
						<Switch
							aria-labelledby='safety-snapshots-label'
							checked={settings.persistTableSnapshots}
							onCheckedChange={(checked) =>
								updateSetting('persistTableSnapshots', checked)
							}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Assistant'>
				<SettingCard>
					<SettingRow
						focusId='safety-hide-ai'
						label='Hide AI'
						labelId='safety-hide-ai-label'
						help='Remove every AI entry point: the assistant panel and its corner button, Cmd+K generation in the SQL console, AI-powered explain and fix actions, and the AI sections in these settings.'
					>
						<Switch
							aria-labelledby='safety-hide-ai-label'
							checked={settings.hideAi}
							onCheckedChange={(checked) => updateSetting('hideAi', checked)}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>
		</>
	)
}

export function StartupScreen() {
	const { settings, updateSetting } = useSettings()
	return (
		<SettingGroup label='Launch'>
			<SettingCard>
				<SettingRow
					focusId='startup-connection-behavior'
					label='Connection behavior'
					htmlFor='startup-connection-select'
					help='Auto-connect to the last used database, or start on an empty view'
				>
					<Select
						value={settings.startupConnectionMode || 'auto'}
						onValueChange={(value) => {
							const mode = value as SettingsState['startupConnectionMode']
							updateSetting('startupConnectionMode', mode)
							updateSetting('restoreLastConnection', mode === 'auto')
						}}
					>
						<SelectTrigger id='startup-connection-select' className='h-8 w-44 text-xs'>
							<SelectValue placeholder='Select startup mode' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='auto'>Auto-connect</SelectItem>
							<SelectItem value='empty'>Start empty</SelectItem>
						</SelectContent>
					</Select>
				</SettingRow>
				<SettingRow
					focusId='startup-restore-tabs'
					label='Restore tabs on launch'
					labelId='startup-tabs-label'
					help='Reopen your tabs from the last session. Pinned tabs always restore.'
				>
					<Switch
						aria-labelledby='startup-tabs-label'
						checked={settings.restoreTabsOnLaunch}
						onCheckedChange={(checked) => updateSetting('restoreTabsOnLaunch', checked)}
					/>
				</SettingRow>
			</SettingCard>
		</SettingGroup>
	)
}

export function InterfaceScreen() {
	const { settings, updateSetting } = useSettings()
	return (
		<>
			<SettingGroup label='Data grid'>
				<SettingCard>
					<SettingRow
						focusId='interface-selection-bar'
						label='Selection bar'
						labelId='interface-selection-label'
						help='Choose the style of the row selection bar'
					>
						<SegmentedControl
							label='Selection bar'
							value={settings.selectionBarStyle || 'static'}
							options={[
								{ value: 'floating', label: 'Floating pill' },
								{ value: 'static', label: 'Static bar' }
							]}
							onChange={(value) => updateSetting('selectionBarStyle', value)}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Window'>
				<SettingCard>
					<SettingRow
						focusId='interface-window-controls'
						label='Window controls'
						labelId='interface-window-label'
						help='Choose between the custom buttons and macOS-style traffic lights (desktop app only)'
					>
						<SegmentedControl
							label='Window controls'
							value={settings.windowControlsStyle || 'custom'}
							options={[
								{ value: 'custom', label: 'Custom' },
								{ value: 'macos', label: 'macOS' }
							]}
							onChange={(value) => updateSetting('windowControlsStyle', value)}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Notifications'>
				<SettingCard>
					<SettingRow
						focusId='interface-show-toasts'
						label='Show toasts'
						labelId='interface-toasts-label'
						help='Enable or disable toast notifications'
					>
						<Switch
							aria-labelledby='interface-toasts-label'
							checked={settings.showToasts !== false}
							onCheckedChange={(checked) => updateSetting('showToasts', checked)}
						/>
					</SettingRow>
				</SettingCard>
			</SettingGroup>
		</>
	)
}
