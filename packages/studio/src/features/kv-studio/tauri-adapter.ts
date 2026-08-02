import { commands } from '@studio/lib/bindings'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import type { KvAdapter, KvCommandResult, KvValueType } from './types'

type CommandResult<T> = { status: 'ok'; data: T } | { status: 'error'; error: unknown }

function unwrap<T>(result: CommandResult<T>): T {
	if (result.status === 'ok') return result.data
	throw new Error(formatBackendError(result.error))
}

function utf8(value: string) {
	return { encoding: 'utf_8' as const, value }
}

function text(value: { encoding: 'utf_8' | 'base_64'; value: string }): string {
	return value.encoding === 'utf_8' ? value.value : `[base64] ${value.value}`
}

function renderRawResult(value: unknown): unknown {
	if (!value || typeof value !== 'object') return value
	const result = value as { type?: string; value?: unknown }
	if (result.type === 'null') return null
	if (result.type === 'bytes' && result.value && typeof result.value === 'object') {
		return text(result.value as { encoding: 'utf_8' | 'base_64'; value: string })
	}
	if (result.type === 'array' || result.type === 'set') {
		return Array.isArray(result.value) ? result.value.map(renderRawResult) : []
	}
	if (result.type === 'map') {
		return Array.isArray(result.value)
			? result.value.map(function (entry) {
					return Array.isArray(entry) ? entry.map(renderRawResult) : entry
				})
			: []
	}
	return result.value
}

function toValueType(value: string): KvValueType | null {
	if (value === 'sorted_set') return 'zset'
	if (value === 'string' || value === 'hash' || value === 'list' || value === 'set') return value
	return null
}

export function createTauriKvAdapter(connectionId: string): KvAdapter {
	async function readValue(key: string, limit = 200) {
		return unwrap(
			await commands.kvRead(connectionId, {
				key: utf8(key),
				cursor: null,
				offset: 0,
				limit
			})
		)
	}

	return {
		async scan(request) {
			const page = unwrap(
				await commands.kvScan(connectionId, {
					cursor: Number(request.cursor),
					pattern: request.pattern ?? null,
					limit: request.count ?? null
				})
			)
			return {
				cursor: String(page.cursor),
				keys: page.keys.flatMap(function (key) {
					const type = toValueType(key.dataType)
					return type ? [{ name: text(key.key), type, ttlMs: key.ttlMs }] : []
				})
			}
		},

		async getValue(key, options) {
			const result = await readValue(key, options?.limit)
			switch (result.value.type) {
				case 'string':
					return {
						type: 'string',
						value: text(result.value.value),
						truncated: result.value.truncated
					}
				case 'hash':
					return {
						type: 'hash',
						entries: result.value.entries.map(function (entry) {
							return { field: text(entry.field), value: text(entry.value) }
						}),
						truncated: result.value.cursor !== 0
					}
				case 'list':
					return {
						type: 'list',
						items: result.value.items.map(text),
						total: result.value.total_items,
						truncated: result.value.has_more
					}
				case 'set':
					return {
						type: 'set',
						members: result.value.members.map(text),
						truncated: result.value.cursor !== 0
					}
				case 'sorted_set':
					return {
						type: 'zset',
						members: result.value.members.map(function (member) {
							return { member: text(member.member), score: member.score }
						}),
						truncated: result.value.cursor !== 0
					}
			}
		},

		async setValue(key, value) {
			if (value.type === 'string') {
				unwrap(await commands.kvSetString(connectionId, utf8(key), utf8(value.value), true))
				return
			}
			const previous = await this.getValue(key, { limit: 1_000 })
			if (value.type === 'hash' && previous.type === 'hash') {
				const nextFields = new Set(value.entries.map((entry) => entry.field))
				for (const entry of previous.entries) {
					if (!nextFields.has(entry.field)) {
						unwrap(
							await commands.kvHashDelete(connectionId, utf8(key), utf8(entry.field))
						)
					}
				}
				for (const entry of value.entries) {
					unwrap(
						await commands.kvHashSet(
							connectionId,
							utf8(key),
							utf8(entry.field),
							utf8(entry.value)
						)
					)
				}
				return
			}
			if (value.type === 'list' && previous.type === 'list') {
				const sharedLength = Math.min(previous.items.length, value.items.length)
				for (let index = 0; index < sharedLength; index += 1) {
					if (previous.items[index] !== value.items[index]) {
						unwrap(
							await commands.kvListSet(
								connectionId,
								utf8(key),
								index,
								utf8(value.items[index])
							)
						)
					}
				}
				for (
					let index = previous.items.length - 1;
					index >= value.items.length;
					index -= 1
				) {
					unwrap(await commands.kvListRemoveAt(connectionId, utf8(key), index))
				}
				for (const item of value.items.slice(previous.items.length)) {
					unwrap(await commands.kvListPush(connectionId, utf8(key), utf8(item), false))
				}
				return
			}
			if (value.type === 'set' && previous.type === 'set') {
				const before = new Set<string>(previous.members)
				const after = new Set<string>(value.members)
				for (const member of before) {
					if (!after.has(member))
						unwrap(await commands.kvSetRemove(connectionId, utf8(key), utf8(member)))
				}
				for (const member of after) {
					if (!before.has(member))
						unwrap(await commands.kvSetAdd(connectionId, utf8(key), utf8(member)))
				}
				return
			}
			if (value.type === 'zset' && previous.type === 'zset') {
				const after = new Set(value.members.map((member) => member.member))
				for (const member of previous.members) {
					if (!after.has(member.member)) {
						unwrap(
							await commands.kvSortedSetRemove(
								connectionId,
								utf8(key),
								utf8(member.member)
							)
						)
					}
				}
				for (const member of value.members) {
					unwrap(
						await commands.kvSortedSetAdd(
							connectionId,
							utf8(key),
							utf8(member.member),
							member.score
						)
					)
				}
				return
			}
			throw new Error('Changing the Redis value type is not supported.')
		},

		async setTtl(key, ttlMs) {
			unwrap(await commands.kvSetTtl(connectionId, utf8(key), ttlMs))
		},

		async deleteKey(key) {
			unwrap(await commands.kvDeleteKey(connectionId, utf8(key)))
		},

		async execute(command, confirmation): Promise<KvCommandResult> {
			const startedAt = performance.now()
			const value = unwrap(
				await commands.kvExecuteRaw(connectionId, command, confirmation ?? null)
			)
			return {
				command,
				value: renderRawResult(value),
				durationMs: performance.now() - startedAt,
				executedAt: Date.now()
			}
		}
	}
}
