export type KvValueType = 'string' | 'hash' | 'list' | 'set' | 'zset'

export type KvKeySummary = {
	name: string
	type: KvValueType
	ttlMs: number | null
}

export type KvScanRequest = {
	cursor: string
	pattern?: string
	count?: number
}

export type KvScanPage = {
	cursor: string
	keys: KvKeySummary[]
}

export type KvStringValue = {
	type: 'string'
	value: string
	truncated?: boolean
}

export type KvHashValue = {
	type: 'hash'
	entries: Array<{ field: string; value: string }>
	truncated?: boolean
}

export type KvListValue = {
	type: 'list'
	items: string[]
	total?: number
	truncated?: boolean
}

export type KvSetValue = {
	type: 'set'
	members: string[]
	total?: number
	truncated?: boolean
}

export type KvZSetValue = {
	type: 'zset'
	members: Array<{ member: string; score: number }>
	total?: number
	truncated?: boolean
}

export type KvValue = KvStringValue | KvHashValue | KvListValue | KvSetValue | KvZSetValue

export type KvCommandResult = {
	command: string
	value: unknown
	durationMs?: number
	executedAt?: number
}

export type KvAdapter = {
	scan(request: KvScanRequest): Promise<KvScanPage>
	getValue(key: string, options?: { limit?: number }): Promise<KvValue>
	setValue(key: string, value: KvValue): Promise<void>
	setTtl(key: string, ttlMs: number | null): Promise<void>
	deleteKey(key: string): Promise<void>
	execute(command: string, confirmation?: string): Promise<KvCommandResult>
}
