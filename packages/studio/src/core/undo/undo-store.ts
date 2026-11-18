import { create } from 'zustand'

type CellMutation = {
	type: 'cell'
	connectionId: string
	tableName: string
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	previousValue: unknown
	newValue: unknown
}

type BatchCellMutation = {
	type: 'batch-cell'
	connectionId: string
	tableName: string
	primaryKeyColumn: string
	cells: Array<{
		primaryKeyValue: unknown
		columnName: string
		previousValue: unknown
		newValue: unknown
	}>
}

type RowDeletion = {
	type: 'row-delete'
	connectionId: string
	tableName: string
	rows: Record<string, unknown>[]
	primaryKeyColumn?: string
}

type Mutation = CellMutation | BatchCellMutation | RowDeletion

type UndoableAction = {
	id: string
	description: string
	mutation: Mutation
	timestamp: number
	expiresAt: number
}

type AddActionOptions = {
	keepRedo?: boolean
}

type UndoStore = {
	actions: UndoableAction[]
	redoActions: UndoableAction[]
	timeoutDuration: number
	addAction: (description: string, mutation: Mutation, options?: AddActionOptions) => string
	removeAction: (id: string) => void
	addRedoAction: (description: string, mutation: Mutation) => string
	removeRedoAction: (id: string) => void
	getLatestRedoAction: () => UndoableAction | undefined
	getAction: (id: string) => UndoableAction | undefined
	getLatestAction: () => UndoableAction | undefined
	clearExpired: () => void
	setTimeoutDuration: (duration: number) => void
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useUndoStore = create<UndoStore>(function (set, get) {
	return {
		actions: [],
		redoActions: [],
		timeoutDuration: 10000,

		addAction: function (description, mutation, options) {
			const id = generateId()
			const now = Date.now()
			const action: UndoableAction = {
				id,
				description,
				mutation,
				timestamp: now,
				expiresAt: now + get().timeoutDuration
			}

			set(function (state) {
				const filtered = state.actions.filter(function (a) {
					return a.expiresAt > now
				})
				return {
					actions: [...filtered, action],
					redoActions: options?.keepRedo ? state.redoActions : []
				}
			})

			setTimeout(function () {
				get().removeAction(id)
			}, get().timeoutDuration)

			return id
		},

		addRedoAction: function (description, mutation) {
			const id = generateId()
			const now = Date.now()
			const action: UndoableAction = {
				id,
				description,
				mutation,
				timestamp: now,
				expiresAt: now + get().timeoutDuration
			}

			set(function (state) {
				return { redoActions: [...state.redoActions, action] }
			})

			setTimeout(function () {
				get().removeRedoAction(id)
			}, get().timeoutDuration)

			return id
		},

		removeRedoAction: function (id) {
			set(function (state) {
				return {
					redoActions: state.redoActions.filter(function (a) {
						return a.id !== id
					})
				}
			})
		},

		getLatestRedoAction: function () {
			const redoActions = get().redoActions
			return redoActions[redoActions.length - 1]
		},

		removeAction: function (id) {
			set(function (state) {
				return {
					actions: state.actions.filter(function (a) {
						return a.id !== id
					})
				}
			})
		},

		getAction: function (id) {
			return get().actions.find(function (a) {
				return a.id === id
			})
		},

		getLatestAction: function () {
			const actions = get().actions
			if (actions.length === 0) return undefined
			return actions[actions.length - 1]
		},

		clearExpired: function () {
			const now = Date.now()
			set(function (state) {
				return {
					actions: state.actions.filter(function (a) {
						return a.expiresAt > now
					})
				}
			})
		},

		setTimeoutDuration: function (duration) {
			set({ timeoutDuration: duration })
		}
	}
})

export type { Mutation, CellMutation, BatchCellMutation, RowDeletion, UndoableAction }
