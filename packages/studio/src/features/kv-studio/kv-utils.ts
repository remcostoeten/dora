import type { KvKeySummary } from './types'

export type NamespaceGroup = {
	name: string
	label: string
	depth: number
	keys: KvKeySummary[]
}

export function groupKeysByNamespace(keys: KvKeySummary[]): NamespaceGroup[] {
	const groups = new Map<string, NamespaceGroup>()

	for (const key of keys) {
		const parts = key.name.split(':')
		const namespace = parts.length > 1 ? parts.slice(0, -1).join(':') : ''
		const existing = groups.get(namespace)
		if (existing) {
			existing.keys.push(key)
			continue
		}
		groups.set(namespace, {
			name: namespace,
			label: namespace || 'root',
			depth: namespace ? namespace.split(':').length - 1 : 0,
			keys: [key]
		})
	}

	return [...groups.values()].sort(function (a, b) {
		if (a.name === '') return -1
		if (b.name === '') return 1
		return a.name.localeCompare(b.name)
	})
}

export function formatTtl(ttlMs: number | null): string {
	if (ttlMs === null) return 'persistent'
	if (ttlMs < 1_000) return `${Math.max(0, ttlMs)}ms`
	if (ttlMs < 60_000) return `${Math.ceil(ttlMs / 1_000)}s`
	if (ttlMs < 3_600_000) return `${Math.ceil(ttlMs / 60_000)}m`
	if (ttlMs < 86_400_000) return `${Math.ceil(ttlMs / 3_600_000)}h`
	return `${Math.ceil(ttlMs / 86_400_000)}d`
}

export function commandName(command: string): string {
	return command.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? ''
}

export function isDestructiveCommand(command: string): boolean {
	return ['FLUSHALL', 'FLUSHDB'].includes(commandName(command))
}

export function prettyString(value: string): string | null {
	try {
		return JSON.stringify(JSON.parse(value), null, 2)
	} catch {
		return null
	}
}
