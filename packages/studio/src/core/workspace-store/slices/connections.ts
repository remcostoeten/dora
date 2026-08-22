import type { Connection } from '@studio/features/connections/types'
import type { ConnectionsSlice, LoadStatus } from '../types'

export type ConnectionsAction =
	| { type: 'connections/set'; connections: Connection[] }
	| { type: 'connections/upsert'; connection: Connection }
	| { type: 'connections/remove'; connectionId: string }
	| { type: 'connections/status'; status: LoadStatus; error?: string | null }

export const initialConnectionsSlice: ConnectionsSlice = {
	ids: [],
	byId: {},
	status: 'idle',
	error: null
}

function sameOrder(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	return a.every((id, index) => id === b[index])
}

function sameConnection(a: Connection | undefined, b: Connection): boolean {
	if (!a) return false
	if (a === b) return true
	const keys = Object.keys(b) as Array<keyof Connection>
	if (Object.keys(a).length !== keys.length) return false
	return keys.every((key) => a[key] === b[key])
}

/**
 * Normalize a fetched list into the slice, reusing the previous object for any
 * connection whose fields are unchanged. Reusing references is what lets a
 * `connection.name` selector stay quiet across a refetch that returned the same
 * data.
 */
function normalize(state: ConnectionsSlice, connections: Connection[]): ConnectionsSlice {
	const ids = connections.map((connection) => connection.id)
	const byId: Record<string, Connection> = {}
	let changed = !sameOrder(ids, state.ids)

	for (const connection of connections) {
		const previous = state.byId[connection.id]
		if (sameConnection(previous, connection)) {
			byId[connection.id] = previous
		} else {
			byId[connection.id] = connection
			changed = true
		}
	}

	if (!changed && state.status === 'ready' && state.error === null) return state
	return {
		ids: changed ? ids : state.ids,
		byId: changed ? byId : state.byId,
		status: 'ready',
		error: null
	}
}

export function reduceConnections(
	state: ConnectionsSlice,
	action: ConnectionsAction
): ConnectionsSlice {
	switch (action.type) {
		case 'connections/set': {
			return normalize(state, action.connections)
		}
		case 'connections/upsert': {
			const connection = action.connection
			if (sameConnection(state.byId[connection.id], connection)) return state
			const ids = state.ids.includes(connection.id)
				? state.ids
				: [...state.ids, connection.id]
			return { ...state, ids, byId: { ...state.byId, [connection.id]: connection } }
		}
		case 'connections/remove': {
			if (!(action.connectionId in state.byId)) return state
			const byId = { ...state.byId }
			delete byId[action.connectionId]
			return { ...state, ids: state.ids.filter((id) => id !== action.connectionId), byId }
		}
		case 'connections/status': {
			const error = action.error ?? null
			if (state.status === action.status && state.error === error) return state
			return { ...state, status: action.status, error }
		}
		default:
			return state
	}
}
