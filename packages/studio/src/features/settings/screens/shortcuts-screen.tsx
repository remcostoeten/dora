import { Search, X } from 'lucide-react'
import {
	SHORTCUT_CATEGORIES,
	useEffectiveShortcuts,
	useShortcutStore,
	type ShortcutName
} from '@studio/core/shortcuts'
import { ShortcutRecorder } from '@studio/features/sidebar/components/shortcut-recorder'
import { Input } from '@studio/shared/ui/input'
import { SettingCard, SettingGroup, SettingRow } from '../components/setting-primitives'

type Props = {
	query: string
	onQueryChange: (query: string) => void
}

export function ShortcutsScreen({ query, onQueryChange }: Props) {
	const { setShortcut, resetShortcut, overrides } = useShortcutStore()
	const shortcuts = useEffectiveShortcuts()
	const needle = query.trim().toLowerCase()

	const categories = Object.entries(SHORTCUT_CATEGORIES)
		.map(([category, names]) => ({
			category,
			names: names.filter((name) => {
				const definition = shortcuts[name]
				if (!definition) return false
				if (!needle) return true
				const combo = Array.isArray(definition.combo)
					? definition.combo.join(' ')
					: definition.combo
				return (
					definition.description.toLowerCase().includes(needle) ||
					combo.toLowerCase().includes(needle)
				)
			})
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
			<div className='relative mb-6'>
				<Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
				<Input
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder='Filter shortcuts'
					aria-label='Filter shortcuts'
					className='h-8 pl-9 pr-8 text-xs'
				/>
				{query ? (
					<button
						type='button'
						aria-label='Clear shortcut filter'
						onClick={() => onQueryChange('')}
						className='absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong focus-visible:text-foreground'
					>
						<X className='h-3.5 w-3.5' />
					</button>
				) : null}
			</div>

			{categories.map(({ category, names }) => (
				<SettingGroup key={category} label={category}>
					<SettingCard>{names.map(renderRow)}</SettingCard>
				</SettingGroup>
			))}

			{needle && categories.length === 0 ? (
				<p className='py-6 text-center text-xs text-muted-foreground'>
					No shortcuts match &ldquo;{query.trim()}&rdquo;
				</p>
			) : null}
		</>
	)
}
