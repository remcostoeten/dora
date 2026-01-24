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

type Mutation = CellMutation | BatchCellMutation

type UndoableAction = {
	id: string
	description: string
	mutation: Mutation
	timestamp: number
	expiresAt: number
}

type UndoStore = {
	actions: UndoableAction[]
	timeoutDuration: number
	addAction: (description: string, mutation: Mutation) => string
	removeAction: (id: string) => void
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
		timeoutDuration: 10000,

		addAction: function (description, mutation) {
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
				return { actions: [...filtered, action] }
			})

			setTimeout(function () {
				get().removeAction(id)
			}, get().timeoutDuration)

			return id
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

export type { Mutation, CellMutation, BatchCellMutation, UndoableAction }
