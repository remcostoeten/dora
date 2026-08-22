import type { DatabaseSchema } from '@studio/lib/bindings'
import type { SchemasSlice } from '../types'

export type SchemasAction =
	| { type: 'schemas/set'; connectionId: string; schema: DatabaseSchema; fetchedAt: number }
	| { type: 'schemas/invalidate'; connectionId: string }
	| { type: 'schemas/clear'; connectionId: string }

export const initialSchemasSlice: SchemasSlice = {
	byConnectionId: {}
}

export function reduceSchemas(state: SchemasSlice, action: SchemasAction): SchemasSlice {
	switch (action.type) {
		case 'schemas/set': {
			const previous = state.byConnectionId[action.connectionId]
			return {
				byConnectionId: {
					...state.byConnectionId,
					[action.connectionId]: {
						schema: action.schema,
						fetchedAt: action.fetchedAt,
						version: (previous?.version ?? 0) + 1
					}
				}
			}
		}
		case 'schemas/invalidate': {
			const previous = state.byConnectionId[action.connectionId]
			if (!previous) return state
			return {
				byConnectionId: {
					...state.byConnectionId,
					[action.connectionId]: { ...previous, version: previous.version + 1 }
				}
			}
		}
		case 'schemas/clear': {
			if (!(action.connectionId in state.byConnectionId)) return state
			const byConnectionId = { ...state.byConnectionId }
			delete byConnectionId[action.connectionId]
			return { byConnectionId }
		}
		default:
			return state
	}
}
