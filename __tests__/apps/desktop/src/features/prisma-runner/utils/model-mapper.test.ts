import { describe, expect, it } from 'vitest'
import type { DatabaseSchema } from '@/lib/bindings'
import {
	tableToModelKey,
	tableToModelName,
	modelKeyToTable
} from '@/features/prisma-runner/utils/model-mapper'

function schema(...tableNames: string[]): DatabaseSchema {
	return {
		tables: tableNames.map(function (name) {
			return { name, schema: 'public', columns: [] }
		}),
		schemas: ['public'],
		unique_columns: []
	}
}

describe('model-mapper', function () {
	it('converts table names to camelCase singular model keys', function () {
		expect(tableToModelKey('user_profiles')).toBe('userProfile')
		expect(tableToModelKey('users')).toBe('user')
		expect(tableToModelKey('posts')).toBe('post')
	})

	it('converts table names to PascalCase singular display names', function () {
		expect(tableToModelName('user_profiles')).toBe('UserProfile')
		expect(tableToModelName('users')).toBe('User')
	})

	it('maps a model key back to its table name', function () {
		const s = schema('user_profiles', 'posts')
		expect(modelKeyToTable('userProfile', s)).toBe('user_profiles')
		expect(modelKeyToTable('post', s)).toBe('posts')
	})

	it('returns null for unknown model keys', function () {
		expect(modelKeyToTable('comment', schema('users'))).toBeNull()
	})
})
