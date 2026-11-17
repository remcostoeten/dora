import {
	SHORTCUT_CATEGORIES,
	useEffectiveShortcuts,
	useShortcutStore,
	type ShortcutName
} from '@studio/core/shortcuts'
import { ShortcutRecorder } from '@studio/features/sidebar/components/shortcut-recorder'
import {
	SettingCard,
	SettingGroup,
	SettingRow,
	isRowVisible,
	useSettingsFilter
} from '../components/setting-primitives'

export function ShortcutsScreen() {
	const { setShortcut, resetShortcut, overrides } = useShortcutStore()
	const shortcuts = useEffectiveShortcuts()
	const filter = useSettingsFilter()

	const categories = Object.entries(SHORTCUT_CATEGORIES)
		.map(([category, names]) => ({
			category,
			names: names.filter(
				(name) => shortcuts[name] && isRowVisible(filter, `shortcut-${name}`)
			)
		}))
		.filter((group) => group.names.length > 0)

	function renderRow(name: ShortcutName) {
		const definition = shortcuts[name]
		return (
			<SettingRow
				key={name}
				focusId={`shortcut-${name}`}
				label={definition.description}
				help={overrides[name] ? 'Customized' : undefined}
			>
				<ShortcutRecorder
					value={definition.combo}
					onChange={(combo) => setShortcut(name, combo)}
					onReset={() => resetShortcut(name)}
					isDefault={!overrides[name]}
					actionLabel={definition.description}
				/>
			</SettingRow>
		)
	}

	return (
		<>
			{categories.map(({ category, names }) => (
				<SettingGroup key={category} label={category}>
					<SettingCard>{names.map(renderRow)}</SettingCard>
				</SettingGroup>
			))}
		</>
	)
}
