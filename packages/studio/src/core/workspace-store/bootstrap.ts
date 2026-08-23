import { resolveAdapter } from '@studio/core/data-provider/resolve-adapter'
import type { BootstrapSnapshot } from '@studio/core/data-provider/types'
import { getAdapterError } from '@studio/core/data-provider/types'
import {
	setConnections,
	setConnectionsError,
	setSavedQueries,
	setSchema,
	setSnippetFolders
} from './actions'
import { workspaceStore } from './store'

let bootstrapped = false
let settingsDocument: string | null = null

/**
 * The settings document bootstrap carried, if it ran. The settings store reads
 * this synchronously on first render instead of issuing its own IPC, which is
 * what removes the settings round-trip from the path to first paint.
 */
export function readBootstrappedSettings(): string | null {
	return settingsDocument
}

export function hasBootstrapped(): boolean {
	return bootstrapped
}

function normalize(snapshot: BootstrapSnapshot): void {
	settingsDocument = snapshot.settings
	setConnections(snapshot.connections)
	setSavedQueries(snapshot.savedQueries, snapshot.snippets)
	setSnippetFolders(snapshot.snippetFolders)
	for (const entry of snapshot.schemas) {
		setSchema(entry.connectionId, entry.schema)
	}
	bootstrapped = true
}

/**
 * Fill the workspace store from one IPC round-trip, before the app renders.
 *
 * Called from the boot path: everything the shell needs — connections,
 * settings, saved queries, snippets and any schema the backend already had
 * cached — lands in the store while the boot screen is still up, so the first
 * paint is a store read rather than a chain of requests.
 *
 * A failure is not fatal. The per-feature queries that predate bootstrap are
 * still in place and will fetch on mount; the app starts a little slower rather
 * than not at all.
 */
export async function hydrateWorkspaceFromBootstrap(): Promise<void> {
	try {
		const adapter = await resolveAdapter()
		const result = await adapter.bootstrap()
		if (!result.ok) {
			console.warn(
				'Bootstrap failed, falling back to per-feature loading:',
				getAdapterError(result)
			)
			setConnectionsError(getAdapterError(result))
			return
		}
		normalize(result.data)
	} catch (error) {
		console.warn('Bootstrap threw, falling back to per-feature loading:', error)
	}
}

/** Test-only: forget that bootstrap ran so a case can drive it again. */
export function resetBootstrapForTests(): void {
	bootstrapped = false
	settingsDocument = null
	workspaceStore.reset()
}
