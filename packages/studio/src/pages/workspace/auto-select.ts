/**
 * Whether the sidebar should select the first table once a connection's schema
 * arrives. Set when the user picks a connection and cleared once the sidebar
 * acts on it.
 *
 * A module flag rather than shell state on purpose: it is a one-shot request
 * handed to the sidebar, and holding it in the shell would mean a shell render
 * every time a connection is selected.
 */
let requested = false

export function requestAutoSelectFirstTable(): void {
	requested = true
}

export function shouldAutoSelectFirstTable(): boolean {
	return requested
}

export function clearAutoSelectFirstTable(): void {
	requested = false
}
