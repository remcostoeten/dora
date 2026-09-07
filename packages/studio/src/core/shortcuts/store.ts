import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
	APP_SHORTCUTS,
	findShortcutConflict,
	formatShortcut,
	ShortcutDefinition,
	ShortcutName
} from './shortcuts'

type UserShortcuts = Partial<Record<ShortcutName, string | string[]>>
type LegacyUserShortcuts = UserShortcuts & { toggleAiAssistant?: string | string[] }

export type ShortcutConflictEventDetail = {
	name: ShortcutName
	requestedCombo: string | string[]
	conflictingName: ShortcutName
	conflictingDescription: string
	conflictingCombo: string
	message: string
}

type ShortcutStore = {
	overrides: UserShortcuts
	setShortcut: (name: ShortcutName, combo: string | string[]) => void
	resetShortcut: (name: ShortcutName) => void
	resetAll: () => void
}

function dispatchShortcutConflict(detail: ShortcutConflictEventDetail) {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent('dora-shortcut-conflict', { detail }))
}

export function getEffectiveShortcuts(overrides: LegacyUserShortcuts = {}) {
	const effective: Record<string, ShortcutDefinition> = {}
	const legacyToggleRightSidebar = overrides.toggleAiAssistant

	for (const [key, def] of Object.entries(APP_SHORTCUTS)) {
		const name = key as ShortcutName
		effective[name] = {
			...def,
			combo:
				overrides[name] ??
				(name === 'toggleRightSidebar' ? legacyToggleRightSidebar : undefined) ??
				def.combo
		}
	}

	return effective as Record<ShortcutName, ShortcutDefinition>
}

export const useShortcutStore = create<ShortcutStore>()(
	persist(
		function (set) {
			return {
				overrides: {},
				setShortcut: function (name, combo) {
					set(function (state) {
						const conflict = findShortcutConflict(
							name,
							combo,
							getEffectiveShortcuts(state.overrides)
						)

						if (conflict) {
							dispatchShortcutConflict({
								name,
								requestedCombo: combo,
								conflictingName: conflict.name,
								conflictingDescription: conflict.definition.description,
								conflictingCombo: conflict.combo,
								message: `Conflicts with ${conflict.definition.description} (${formatShortcut(conflict.combo)})`
							})
							return state
						}

						return {
							overrides: { ...state.overrides, [name]: combo }
						}
					})
				},
				resetShortcut: function (name) {
					set(function (state) {
						// Create a copy and delete the key to reset to default
						const newOverrides = { ...state.overrides }
						delete newOverrides[name]
						return { overrides: newOverrides }
					})
				},
				resetAll: function () {
					set({ overrides: {} })
				}
			}
		},
		{
			name: 'dora-shortcuts'
		}
	)
)

export function useEffectiveShortcuts() {
	const overrides = useShortcutStore(function (state) {
		return state.overrides
	})

	return getEffectiveShortcuts(overrides)
}
