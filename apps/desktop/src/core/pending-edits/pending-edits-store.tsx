import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type PendingEdit = {
	rowIndex: number
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

const PendingEditsContext = createContext<PendingEditsContextValue | null>(null)

function createEditKey(tableId: string, primaryKeyValue: unknown, columnName: string): string {
	return `${tableId}:${String(primaryKeyValue)}:${columnName}`
}

type Props = {
	children: ReactNode
}

export function PendingEditsProvider({ children }: Props) {
	const [isDryEditMode, setDryEditMode] = useState(false)
	const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map())

	const addEdit = useCallback(function (tableId: string, edit: PendingEdit) {
		setPendingEdits(function (prev) {
			const next = new Map(prev)
			const key = createEditKey(tableId, edit.primaryKeyValue, edit.columnName)
			next.set(key, edit)
			return next
		})
	}, [])

	const removeEdit = useCallback(function (tableId: string, key: string) {
		setPendingEdits(function (prev) {
			const next = new Map(prev)
			next.delete(key)
			return next
		})
	}, [])

	const clearEdits = useCallback(function (tableId?: string) {
		if (tableId) {
			setPendingEdits(function (prev) {
				const next = new Map(prev)
				for (const key of prev.keys()) {
					if (key.startsWith(tableId + ':')) {
						next.delete(key)
					}
				}
				return next
			})
		} else {
			setPendingEdits(new Map())
		}
	}, [])

	const getEditsForTable = useCallback(
		function (tableId: string): PendingEdit[] {
			const edits: PendingEdit[] = []
			for (const [key, edit] of pendingEdits.entries()) {
				if (key.startsWith(tableId + ':')) {
					edits.push(edit)
				}
			}
			return edits
		},
		[pendingEdits]
	)

	const getEditCount = useCallback(
		function (tableId?: string): number {
			if (tableId) {
				let count = 0
				for (const key of pendingEdits.keys()) {
					if (key.startsWith(tableId + ':')) {
						count++
					}
				}
				return count
			}
			return pendingEdits.size
		},
		[pendingEdits]
	)

	const hasEdits = useCallback(
		function (tableId?: string): boolean {
			return getEditCount(tableId) > 0
		},
		[getEditCount]
	)

	const value: PendingEditsContextValue = {
		isDryEditMode,
		setDryEditMode,
		pendingEdits,
		addEdit,
		removeEdit,
		clearEdits,
		getEditsForTable,
		getEditCount,
		hasEdits
	}

	return <PendingEditsContext.Provider value={value}>{children}</PendingEditsContext.Provider>
}

export function usePendingEdits(): PendingEditsContextValue {
	const context = useContext(PendingEditsContext)
	if (!context) {
		throw new Error('usePendingEdits must be used within PendingEditsProvider')
	}
	return context
}
