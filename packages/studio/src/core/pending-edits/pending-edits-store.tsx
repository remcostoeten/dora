import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'

export type PendingEdit = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	oldValue: unknown
	newValue: unknown
}

type PendingEditsContextValue = {
	isDryEditMode: boolean
	setDryEditMode: (enabled: boolean) => void
	pendingEdits: Map<string, PendingEdit>
	addEdit: (tableId: string, edit: PendingEdit) => void
	removeEdit: (tableId: string, key: string) => void
	clearEdits: (tableId?: string) => void
	getEditsForTable: (tableId: string) => PendingEdit[]
	getEditCount: (tableId?: string) => number
	hasEdits: (tableId?: string) => boolean
}

export function createEditKey(
	tableId: string,
	primaryKeyValue: unknown,
	columnName: string
): string {
	return `${tableId}:${String(primaryKeyValue)}:${columnName}`
}

type Props = {
	children: ReactNode
}

export function PendingEditsProvider({ children }: Props) {
	return children
}

type ConnectionEditState = {
	isDryEditMode: boolean
	pendingEdits: Map<string, PendingEdit>
}

const connectionEditStates = new Map<string, ConnectionEditState>()
const connectionEditListeners = new Map<string, Set<() => void>>()

function getConnectionEditState(connectionId: string): ConnectionEditState {
	return (
		connectionEditStates.get(connectionId) ?? {
			isDryEditMode: false,
			pendingEdits: new Map()
		}
	)
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

	const addEdit = useCallback(
		(tableId: string, edit: PendingEdit) => {
			updateConnectionEditState(connectionId, (current) => {
				const next = new Map(current.pendingEdits)
				const key = createEditKey(tableId, edit.primaryKeyValue, edit.columnName)
				next.set(key, edit)
				return { ...current, pendingEdits: next }
			})
		},
		[connectionId]
	)

	const removeEdit = useCallback(
		(tableId: string, key: string) => {
			updateConnectionEditState(connectionId, (current) => {
				const next = new Map(current.pendingEdits)
				next.delete(key)
				return { ...current, pendingEdits: next }
			})
		},
		[connectionId]
	)

	const clearEdits = useCallback(
		(tableId?: string) => {
			updateConnectionEditState(connectionId, (current) => {
				if (tableId) {
					const next = new Map(current.pendingEdits)
					for (const key of current.pendingEdits.keys()) {
						if (key.startsWith(tableId + ':')) {
							next.delete(key)
						}
					}
					return { ...current, pendingEdits: next }
				}
				return { ...current, pendingEdits: new Map() }
			})
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
			removeEdit,
			clearEdits,
			getEditsForTable,
			getEditCount,
			hasEdits
		}),
		[
			state.isDryEditMode,
			state.pendingEdits,
			addEdit,
			removeEdit,
			clearEdits,
			getEditsForTable,
			getEditCount,
			hasEdits
		]
	)

	return value
}
