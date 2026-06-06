import { clearTableDataCache } from './table-cache'

const SCHEMA_MUTATION_PATTERN =
	/\b(create|alter|drop|truncate|rename|attach|detach|insert|delete|merge|replace)\b/i

export function shouldRefreshSchemaAfterQuery(sql: string): boolean {
	return SCHEMA_MUTATION_PATTERN.test(sql)
}

export function notifySchemaChanged(connectionId: string, sql: string): void {
	if (typeof window === 'undefined' || !connectionId) return
	if (!shouldRefreshSchemaAfterQuery(sql)) return

	clearTableDataCache()
	window.dispatchEvent(
		new CustomEvent('dora-schema-refresh', {
			detail: { connectionId }
		})
	)
}
