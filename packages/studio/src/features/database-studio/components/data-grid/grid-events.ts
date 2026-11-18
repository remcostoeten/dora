/**
 * @name isDataGridEvent
 * @description Whether a keyboard event started inside a data grid. The grid
 * runs its own command table, so window-level bindings for the same actions
 * use this to stay out of the way.
 *
 * @example
 * $.bind(shortcuts.deleteRows.combo).except(isDataGridEvent).on(deleteRows)
 */
export function isDataGridEvent(event: KeyboardEvent): boolean {
	const target = event.target
	return target instanceof Element && target.closest('[data-dora-grid]') !== null
}

/**
 * @name isTextEntryEvent
 * @description Whether a keyboard event comes from a control the user types
 * into, such as the cell editor or a draft row input. Grid commands never run
 * for those.
 *
 * @example
 * if (isTextEntryEvent(event)) return
 */
export function isTextEntryEvent(event: KeyboardEvent): boolean {
	const target = event.target
	if (!(target instanceof HTMLElement)) return false
	return (
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.tagName === 'SELECT' ||
		target.isContentEditable
	)
}
