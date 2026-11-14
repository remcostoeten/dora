import { createContext, useContext, useEffect, type RefObject } from 'react'
import { useStore } from 'zustand'
import type { DialogActions, DialogState, DialogStore, FocusTarget } from './store'

const DialogStoreContext = createContext<DialogStore | null>(null)

export const DialogStoreProvider = DialogStoreContext.Provider

export function useDialogStore(): DialogStore {
	const store = useContext(DialogStoreContext)
	if (!store) throw new Error('useDialogStore must be used inside the connection dialog')
	return store
}

/**
 * @name useDialog
 * @description Subscribes to a slice of the dialog state. The component
 * re-renders only when the selected value changes, so select primitives.
 *
 * @example
 * const step = useDialog((state) => state.step)
 */
export function useDialog<Selected>(
	selector: (state: DialogState & DialogActions) => Selected
): Selected {
	return useStore(useDialogStore(), selector)
}

/**
 * @name useFocusRequest
 * @description Focuses the element when the store asks for this target, then
 * clears the request so remounting the element later does not steal focus.
 *
 * @example
 * useFocusRequest('host', inputRef)
 */
export function useFocusRequest(
	target: FocusTarget,
	ref: RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null>
) {
	const store = useDialogStore()
	const request = useDialog((state) =>
		state.focusRequest?.target === target ? state.focusRequest : null
	)

	useEffect(() => {
		const element = ref.current
		if (!request || !element) return
		element.focus()
		if (element instanceof HTMLInputElement) element.select()
		store.setState({ focusRequest: null })
	}, [request, ref, store])
}
