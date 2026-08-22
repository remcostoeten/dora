import { tableSnapshotKey, type TableSnapshot, type TableSnapshotsSlice } from '../types'

export type TableSnapshotsAction =
	| { type: 'tableSnapshots/put'; snapshot: TableSnapshot }
	| {
			type: 'tableSnapshots/patchRows'
			connectionId: string
			tableId: string
			rows: Record<string, unknown>[]
	  }
	| { type: 'tableSnapshots/dropForConnection'; connectionId: string }
	| { type: 'tableSnapshots/clear' }

export const initialTableSnapshotsSlice: TableSnapshotsSlice = {
	byKey: {}
}

export function reduceTableSnapshots(
	state: TableSnapshotsSlice,
	action: TableSnapshotsAction
): TableSnapshotsSlice {
	switch (action.type) {
		case 'tableSnapshots/put': {
			const key = tableSnapshotKey(action.snapshot.connectionId, action.snapshot.tableId)
			if (state.byKey[key] === action.snapshot) return state
			return { byKey: { ...state.byKey, [key]: action.snapshot } }
		}
		case 'tableSnapshots/patchRows': {
			const key = tableSnapshotKey(action.connectionId, action.tableId)
			const previous = state.byKey[key]
			if (!previous) return state
			return { byKey: { ...state.byKey, [key]: { ...previous, rows: action.rows } } }
		}
		case 'tableSnapshots/dropForConnection': {
			const prefix = `${action.connectionId}::`
			const keys = Object.keys(state.byKey).filter((key) => key.startsWith(prefix))
			if (keys.length === 0) return state
			const byKey = { ...state.byKey }
			for (const key of keys) delete byKey[key]
			return { byKey }
		}
		case 'tableSnapshots/clear': {
			if (Object.keys(state.byKey).length === 0) return state
			return { byKey: {} }
		}
		default:
			return state
	}
}
