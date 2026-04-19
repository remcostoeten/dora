export type ChangeType = 'insert' | 'update' | 'delete'

export type ChangeEvent = {
	id: string
	timestamp: number
	changeType: ChangeType
	tableName: string
	summary: string
	rowCount: number
}

export type LiveMonitorConfig = {
	enabled: boolean
	intervalMs: number
	changeTypes: ChangeType[]
}

export const DEFAULT_CONFIG: LiveMonitorConfig = {
	enabled: true,
	intervalMs: 5000,
	changeTypes: ['insert', 'update', 'delete']
}
