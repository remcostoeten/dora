import {
	initialConnectionsSlice,
	reduceConnections,
	type ConnectionsAction
} from './slices/connections'
import {
	initialSavedQueriesSlice,
	reduceSavedQueries,
	type SavedQueriesAction
} from './slices/saved-queries'
import { initialSchemasSlice, reduceSchemas, type SchemasAction } from './slices/schemas'
import { initialSnippetsSlice, reduceSnippets, type SnippetsAction } from './slices/snippets'
import {
	initialTableSnapshotsSlice,
	reduceTableSnapshots,
	type TableSnapshotsAction
} from './slices/table-snapshots'
import { initialTabsSlice, reduceTabs, type TabsAction } from './slices/tabs'
import { initialUiChromeSlice, reduceUiChrome, type UiChromeAction } from './slices/ui-chrome'
import type { WorkspaceState } from './types'

export type WorkspaceAction =
	| ConnectionsAction
	| SchemasAction
	| TabsAction
	| TableSnapshotsAction
	| SavedQueriesAction
	| SnippetsAction
	| UiChromeAction

export type WorkspaceStore = {
	getState: () => WorkspaceState
	subscribe: (listener: () => void) => () => void
	dispatch: (action: WorkspaceAction) => void
	/** Test-only: return the store to its initial state between cases. */
	reset: () => void
}

export function createInitialWorkspaceState(): WorkspaceState {
	return {
		connections: initialConnectionsSlice,
		schemas: initialSchemasSlice,
		tabs: initialTabsSlice,
		tableSnapshots: initialTableSnapshotsSlice,
		savedQueries: initialSavedQueriesSlice,
		snippets: initialSnippetsSlice,
		uiChrome: initialUiChromeSlice
	}
}

/**
 * Route an action to its slice. Every slice reducer returns its own state
 * unchanged when the action is not its own, and the root returns the same
 * state object when no slice moved — that identity is what narrow selectors
 * rely on to stay quiet.
 */
export function reduceWorkspace(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
	const domain = action.type.slice(0, action.type.indexOf('/'))

	switch (domain) {
		case 'connections': {
			const connections = reduceConnections(state.connections, action as ConnectionsAction)
			return connections === state.connections ? state : { ...state, connections }
		}
		case 'schemas': {
			const schemas = reduceSchemas(state.schemas, action as SchemasAction)
			return schemas === state.schemas ? state : { ...state, schemas }
		}
		case 'tabs': {
			const tabs = reduceTabs(state.tabs, action as TabsAction)
			return tabs === state.tabs ? state : { ...state, tabs }
		}
		case 'tableSnapshots': {
			const tableSnapshots = reduceTableSnapshots(
				state.tableSnapshots,
				action as TableSnapshotsAction
			)
			return tableSnapshots === state.tableSnapshots ? state : { ...state, tableSnapshots }
		}
		case 'savedQueries': {
			const savedQueries = reduceSavedQueries(
				state.savedQueries,
				action as SavedQueriesAction
			)
			return savedQueries === state.savedQueries ? state : { ...state, savedQueries }
		}
		case 'snippets': {
			const snippets = reduceSnippets(state.snippets, action as SnippetsAction)
			return snippets === state.snippets ? state : { ...state, snippets }
		}
		case 'uiChrome': {
			const uiChrome = reduceUiChrome(state.uiChrome, action as UiChromeAction)
			return uiChrome === state.uiChrome ? state : { ...state, uiChrome }
		}
		default:
			return state
	}
}

export function createWorkspaceStore(
	initialState: WorkspaceState = createInitialWorkspaceState()
): WorkspaceStore {
	let state = initialState
	const listeners = new Set<() => void>()

	function getState(): WorkspaceState {
		return state
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener)
		return function unsubscribe() {
			listeners.delete(listener)
		}
	}

	function dispatch(action: WorkspaceAction): void {
		const next = reduceWorkspace(state, action)
		if (next === state) return
		state = next
		listeners.forEach((listener) => listener())
	}

	function reset(): void {
		state = createInitialWorkspaceState()
		listeners.forEach((listener) => listener())
	}

	return { getState, subscribe, dispatch, reset }
}

/**
 * The one store the app runs on. It lives outside React so a connection or tab
 * read is a plain object lookup, not a context traversal, and so non-React
 * callers (the adapter layer, the editor host) can read and write it.
 */
export const workspaceStore = createWorkspaceStore()

export function dispatchWorkspace(action: WorkspaceAction): void {
	workspaceStore.dispatch(action)
}

export function readWorkspace(): WorkspaceState {
	return workspaceStore.getState()
}

/** Test-only: return the store to its initial state between cases. */
export function resetWorkspaceStore(): void {
	workspaceStore.reset()
}
