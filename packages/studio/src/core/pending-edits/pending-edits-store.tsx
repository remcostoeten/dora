import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'

import {
	createEditKey,
	dropEdits as dropStagedEdits,
	redoStaged,
	revertEdits as revertStagedEdits,
	stageEdits,
	undoStaged,
	type PendingEdit,
	type StagedEntry,
	type StagedState
} from './staged-history'

export { createEditKey, type PendingEdit }

type PendingEditsContextValue = {
	isDryEditMode: boolean
	setDryEditMode: (enabled: boolean) => void
	pendingEdits: Map<string, PendingEdit>
	addEdit: (tableId: string, edit: PendingEdit) => void
	addEdits: (tableId: string, edits: PendingEdit[]) => void
	removeEdit: (tableId: string, key: string) => void
	revertEdits: (tableId: string, keys: string[]) => void
	clearEdits: (tableId?: string) => void
	undoStagedEdit: (tableId: string) => StagedEntry | null
	redoStagedEdit: (tableId: string) => StagedEntry | null
	getEditsForTable: (tableId: string) => PendingEdit[]
	getEditCount: (tableId?: string) => number
	hasEdits: (tableId?: string) => boolean
}

type Props = {
	children: ReactNode
}

export function PendingEditsProvider({ children }: Props) {
	return children
}

type ConnectionEditState = StagedState & {
	isDryEditMode: boolean
}

const connectionEditStates = new Map<string, ConnectionEditState>()
const connectionEditListeners = new Map<string, Set<() => void>>()

const EMPTY_EDIT_STATE: ConnectionEditState = {
	isDryEditMode: false,
	pendingEdits: new Map(),
	undoStack: [],
	redoStack: []
}

function getConnectionEditState(connectionId: string): ConnectionEditState {
	return connectionEditStates.get(connectionId) ?? EMPTY_EDIT_STATE
}

function updateConnectionEditState(
	connectionId: string,
	update: (state: ConnectionEditState) => ConnectionEditState
): void {
	connectionEditStates.set(connectionId, update(getConnectionEditState(connectionId)))
	connectionEditListeners.get(connectionId)?.forEach((listener) => listener())
}

function subscribeToConnectionEdits(connectionId: string, listener: () => void): () => void {
	const listeners = connectionEditListeners.get(connectionId) ?? new Set()
	listeners.add(listener)
	connectionEditListeners.set(connectionId, listeners)
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0) connectionEditListeners.delete(connectionId)
	}
}

export function usePendingEdits(connectionId = ''): PendingEditsContextValue {
	const [, setVersion] = useState(0)
	const state = getConnectionEditState(connectionId)

	useEffect(() => {
		return subscribeToConnectionEdits(connectionId, () => {
			setVersion((version) => version + 1)
		})
	}, [connectionId])

	const setDryEditMode = useCallback(
		(enabled: boolean) => {
			updateConnectionEditState(connectionId, (current) => {
				return { ...current, isDryEditMode: enabled }
			})
		},
		[connectionId]
	)

	const addEdits = useCallback(
		(tableId: string, edits: PendingEdit[]) => {
			updateConnectionEditState(connectionId, (current) => {
				return { ...current, ...stageEdits(current, tableId, edits) }
			})
		},
		[connectionId]
	)

	const addEdit = useCallback(
		(tableId: string, edit: PendingEdit) => addEdits(tableId, [edit]),
		[addEdits]
	)

	const revertEdits = useCallback(
		(tableId: string, keys: string[]) => {
			updateConnectionEditState(connectionId, (current) => {
				return { ...current, ...revertStagedEdits(current, tableId, keys) }
			})
		},
		[connectionId]
	)

	const removeEdit = useCallback(
		(tableId: string, key: string) => {
			updateConnectionEditState(connectionId, (current) => {
				return { ...current, ...dropStagedEdits(current, tableId, [key]) }
			})
		},
		[connectionId]
	)

	const clearEdits = useCallback(
		(tableId?: string) => {
			updateConnectionEditState(connectionId, (current) => {
				return { ...current, ...dropStagedEdits(current, tableId) }
			})
		},
		[connectionId]
	)

	const undoStagedEdit = useCallback(
		(tableId: string) => {
			const step = undoStaged(getConnectionEditState(connectionId), tableId)
			if (!step.entry) return null
			updateConnectionEditState(connectionId, (current) => ({ ...current, ...step.state }))
			return step.entry
		},
		[connectionId]
	)

	const redoStagedEdit = useCallback(
		(tableId: string) => {
			const step = redoStaged(getConnectionEditState(connectionId), tableId)
			if (!step.entry) return null
			updateConnectionEditState(connectionId, (current) => ({ ...current, ...step.state }))
			return step.entry
		},
		[connectionId]
	)

	const getEditsForTable = useCallback(
		(tableId: string): PendingEdit[] => {
			const edits: PendingEdit[] = []
			for (const [key, edit] of state.pendingEdits.entries()) {
				if (key.startsWith(tableId + ':')) {
					edits.push(edit)
				}
			}
			return edits
		},
		[state.pendingEdits]
	)

	const getEditCount = useCallback(
		(tableId?: string): number => {
			if (tableId) {
				let count = 0
				for (const key of state.pendingEdits.keys()) {
					if (key.startsWith(tableId + ':')) {
						count++
					}
				}
				return count
			}
			return state.pendingEdits.size
		},
		[state.pendingEdits]
	)

	const hasEdits = useCallback(
		(tableId?: string): boolean => {
			return getEditCount(tableId) > 0
		},
		[getEditCount]
	)

	const value: PendingEditsContextValue = useMemo(
		() => ({
			isDryEditMode: state.isDryEditMode,
			setDryEditMode,
			pendingEdits: state.pendingEdits,
			addEdit,
			addEdits,
			removeEdit,
			revertEdits,
			clearEdits,
			undoStagedEdit,
			redoStagedEdit,
			getEditsForTable,
			getEditCount,
			hasEdits
		}),
		[
			state.isDryEditMode,
			state.pendingEdits,
			addEdit,
			addEdits,
			removeEdit,
			revertEdits,
			clearEdits,
			undoStagedEdit,
			redoStagedEdit,
			getEditsForTable,
			getEditCount,
			hasEdits
		]
	)

	return value
}
