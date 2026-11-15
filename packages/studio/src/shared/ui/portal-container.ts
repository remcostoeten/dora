const PORTAL_CONTAINER_ID = 'dora-portals'

let container: HTMLElement | null = null

/**
 * @name getPortalContainer
 * @description Returns the element every overlay primitive portals into,
 * creating it after the app root when the host page did not ship one. Appending
 * a portal straight to `body` makes the app root lose its `:last-child` state,
 * which re-styles the whole app subtree on every open and close.
 *
 * @example
 * <DialogPrimitive.Portal container={getPortalContainer()}>
 *   {children}
 * </DialogPrimitive.Portal>
 */
export function getPortalContainer(): HTMLElement | undefined {
	if (typeof document === 'undefined') return undefined
	if (container?.isConnected) return container

	const existing = document.getElementById(PORTAL_CONTAINER_ID)
	if (existing) {
		container = existing
		return existing
	}

	const created = document.createElement('div')
	created.id = PORTAL_CONTAINER_ID
	const tail = document.createElement('span')
	tail.hidden = true
	document.body.append(created, tail)
	container = created
	return created
}
