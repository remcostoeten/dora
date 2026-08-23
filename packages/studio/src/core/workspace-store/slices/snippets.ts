import type { SnippetFolder } from '@studio/lib/bindings'
import type { LoadStatus, SnippetsSlice } from '../types'

export type SnippetsAction =
	| { type: 'snippets/setFolders'; folders: SnippetFolder[] }
	| { type: 'snippets/status'; status: LoadStatus }

export const initialSnippetsSlice: SnippetsSlice = {
	folders: [],
	status: 'idle'
}

export function reduceSnippets(state: SnippetsSlice, action: SnippetsAction): SnippetsSlice {
	switch (action.type) {
		case 'snippets/setFolders': {
			return { folders: action.folders, status: 'ready' }
		}
		case 'snippets/status': {
			if (state.status === action.status) return state
			return { ...state, status: action.status }
		}
		default:
			return state
	}
}
