import type { SavedQuery } from '@studio/lib/bindings'
import type { LoadStatus, SavedQueriesSlice } from '../types'

export type SavedQueriesAction =
	| { type: 'savedQueries/set'; savedQueries: SavedQuery[] }
	| { type: 'savedQueries/upsert'; savedQuery: SavedQuery }
	| { type: 'savedQueries/remove'; id: number }
	| { type: 'savedQueries/status'; status: LoadStatus }

export const initialSavedQueriesSlice: SavedQueriesSlice = {
	ids: [],
	byId: {},
	status: 'idle'
}

export function reduceSavedQueries(
	state: SavedQueriesSlice,
	action: SavedQueriesAction
): SavedQueriesSlice {
	switch (action.type) {
		case 'savedQueries/set': {
			const ids = action.savedQueries.map((savedQuery) => savedQuery.id)
			const byId: Record<number, SavedQuery> = {}
			for (const savedQuery of action.savedQueries) byId[savedQuery.id] = savedQuery
			return { ids, byId, status: 'ready' }
		}
		case 'savedQueries/upsert': {
			const id = action.savedQuery.id
			const ids = state.ids.includes(id) ? state.ids : [...state.ids, id]
			return { ...state, ids, byId: { ...state.byId, [id]: action.savedQuery } }
		}
		case 'savedQueries/remove': {
			if (!(action.id in state.byId)) return state
			const byId = { ...state.byId }
			delete byId[action.id]
			return { ...state, ids: state.ids.filter((id) => id !== action.id), byId }
		}
		case 'savedQueries/status': {
			if (state.status === action.status) return state
			return { ...state, status: action.status }
		}
		default:
			return state
	}
}
