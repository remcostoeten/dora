import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { APP_SHORTCUTS, ShortcutDefinition, ShortcutName } from './shortcuts'

type UserShortcuts = Partial<Record<ShortcutName, string | string[]>>

type ShortcutStore = {
    overrides: UserShortcuts
    setShortcut: (name: ShortcutName, combo: string | string[]) => void
    resetShortcut: (name: ShortcutName) => void
    resetAll: () => void
}

export const useShortcutStore = create<ShortcutStore>()(
    persist(
        function (set) {
            return {
                overrides: {},
                setShortcut: function (name, combo) {
                    set(function (state) {
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

    const effective: Record<string, ShortcutDefinition> = {}

    for (const [key, def] of Object.entries(APP_SHORTCUTS)) {
        const name = key as ShortcutName
        effective[name] = {
            ...def,
            combo: overrides[name] ?? def.combo
        }
    }

    return effective as Record<ShortcutName, ShortcutDefinition>
}
