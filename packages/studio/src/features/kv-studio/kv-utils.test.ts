import { describe, expect, it } from 'vitest'
import {
	commandName,
	formatTtl,
	groupKeysByNamespace,
	isDestructiveCommand,
	prettyString
} from './kv-utils'

describe('KV studio utilities', function () {
	it('groups colon-delimited keys without losing root keys', function () {
		const groups = groupKeysByNamespace([
			{ name: 'health', type: 'string', ttlMs: null },
			{ name: 'user:1:profile', type: 'hash', ttlMs: 1_000 },
			{ name: 'user:1:roles', type: 'set', ttlMs: null }
		])
		expect(groups.map((group) => [group.label, group.keys.length])).toEqual([
			['root', 1],
			['user:1', 2]
		])
	})

	it('detects only explicitly gated flush commands', function () {
		expect(commandName('  flushdb ASYNC')).toBe('FLUSHDB')
		expect(isDestructiveCommand('flushall')).toBe(true)
		expect(isDestructiveCommand('DEL important')).toBe(false)
	})

	it('formats TTLs and JSON previews', function () {
		expect(formatTtl(null)).toBe('persistent')
		expect(formatTtl(61_000)).toBe('2m')
		expect(prettyString('{"ok":true}')).toContain('\n')
		expect(prettyString('plain text')).toBeNull()
	})
})
