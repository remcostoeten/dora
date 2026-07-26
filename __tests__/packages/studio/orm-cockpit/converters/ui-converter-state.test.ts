import { describe, expect, it } from 'vitest'
import type {
	ConvertOptions,
	ConvertResult
} from '@studio/features/orm-cockpit/converters/contract'
import {
	converterReducer,
	createConverterState,
	flipDirection,
	outputText,
	paneLanguages,
	runConversion,
	visibleWarnings,
	type ConverterPair,
	type ConverterState
} from '@studio/features/orm-cockpit/components/converter-state'
import {
	mockDrizzleToSql,
	mockSqlToDrizzle
} from '@studio/features/orm-cockpit/converters/mock-converters'

const MOCKS: ConverterPair = { drizzleToSql: mockDrizzleToSql, sqlToDrizzle: mockSqlToDrizzle }

function spyPair(): { pair: ConverterPair; calls: Array<[string, ConvertOptions, string]> } {
	const calls: Array<[string, ConvertOptions, string]> = []
	function ok(output: string): ConvertResult {
		return { ok: true, surface: 'schema', output, warnings: [] }
	}
	return {
		calls,
		pair: {
			drizzleToSql: (source, options) => {
				calls.push([source, options, 'drizzleToSql'])
				return ok('sql')
			},
			sqlToDrizzle: (source, options) => {
				calls.push([source, options, 'sqlToDrizzle'])
				return ok('drizzle')
			}
		}
	}
}

function withResult(state: ConverterState, result: ConvertResult): ConverterState {
	return converterReducer(state, { type: 'converted', result })
}

describe('converter-state', function () {
	it('starts on drizzle → sql with an empty buffer', function () {
		const state = createConverterState()
		expect(state.direction).toBe('drizzle-to-sql')
		expect(state.dialect).toBe('postgres')
		expect(state.input).toBe('')
		expect(state.result).toBeNull()
		expect(paneLanguages(state.direction)).toEqual({ input: 'typescript', output: 'sql' })
	})

	it('flips direction and drops a stale result', function () {
		const state = withResult(createConverterState(), {
			ok: true,
			surface: 'schema',
			output: 'SELECT 1',
			warnings: []
		})
		const next = converterReducer(state, { type: 'set-direction', direction: 'sql-to-drizzle' })
		expect(next.direction).toBe('sql-to-drizzle')
		expect(next.result).toBeNull()
		expect(paneLanguages(next.direction)).toEqual({ input: 'sql', output: 'typescript' })
		expect(flipDirection(next.direction)).toBe('drizzle-to-sql')
	})

	it('swap carries the output into the input', function () {
		const typed = converterReducer(createConverterState(), {
			type: 'set-input',
			input: "pgTable('users', {})"
		})
		const converted = withResult(typed, {
			ok: true,
			surface: 'schema',
			output: 'CREATE TABLE "users" ();',
			warnings: []
		})
		const swapped = converterReducer(converted, { type: 'swap' })
		expect(swapped.direction).toBe('sql-to-drizzle')
		expect(swapped.input).toBe('CREATE TABLE "users" ();')
		expect(swapped.result).toBeNull()
	})

	it('swap keeps the input when the last conversion failed', function () {
		const typed = converterReducer(createConverterState(), {
			type: 'set-input',
			input: 'db.select().having(x)'
		})
		const failed = withResult(typed, {
			ok: false,
			errors: [{ code: 'unsupported-construct', message: 'nope' }]
		})
		const swapped = converterReducer(failed, { type: 'swap' })
		expect(swapped.input).toBe('db.select().having(x)')
		expect(outputText(swapped.result)).toBe('')
	})

	it('re-shows warnings after an edit but hides them once dismissed', function () {
		const state = withResult(createConverterState(), {
			ok: true,
			surface: 'schema',
			output: 'x',
			warnings: ['lossy']
		})
		expect(visibleWarnings(state)).toEqual(['lossy'])
		const dismissed = converterReducer(state, { type: 'dismiss-warnings' })
		expect(visibleWarnings(dismissed)).toEqual([])
		const edited = converterReducer(dismissed, { type: 'set-input', input: 'edited' })
		expect(visibleWarnings(edited)).toEqual(['lossy'])
	})

	it('ignores no-op updates so the debounce is not re-armed', function () {
		const state = converterReducer(createConverterState(), { type: 'set-input', input: 'a' })
		expect(converterReducer(state, { type: 'set-input', input: 'a' })).toBe(state)
		expect(converterReducer(state, { type: 'set-dialect', dialect: 'postgres' })).toBe(state)
		expect(
			converterReducer(state, { type: 'set-direction', direction: 'drizzle-to-sql' })
		).toBe(state)
		expect(converterReducer(state, { type: 'clear-result' })).toBe(state)
	})

	it('clear-result wipes a stale conversion', function () {
		const state = withResult(createConverterState(), {
			ok: true,
			surface: 'query',
			output: 'x',
			warnings: []
		})
		expect(converterReducer(state, { type: 'clear-result' }).result).toBeNull()
	})

	it('dispatches to the converter matching the direction and dialect', function () {
		const { pair, calls } = spyPair()
		runConversion({ input: 'a', dialect: 'mysql', direction: 'drizzle-to-sql' }, pair)
		runConversion({ input: 'b', dialect: 'sqlite', direction: 'sql-to-drizzle' }, pair)
		expect(calls).toEqual([
			['a', { dialect: 'mysql' }, 'drizzleToSql'],
			['b', { dialect: 'sqlite' }, 'sqlToDrizzle']
		])
	})
})

describe('mock converters (placeholder wiring)', function () {
	it('is deterministic for the same input and options', function () {
		const first = runConversion(
			{
				input: 'CREATE TABLE users (id int)',
				dialect: 'postgres',
				direction: 'sql-to-drizzle'
			},
			MOCKS
		)
		const second = runConversion(
			{
				input: 'CREATE TABLE users (id int)',
				dialect: 'postgres',
				direction: 'sql-to-drizzle'
			},
			MOCKS
		)
		expect(first).toEqual(second)
		expect(outputText(first)).toContain('pgTable')
	})

	it('fails on empty input', function () {
		const result = runConversion(
			{ input: '   ', dialect: 'postgres', direction: 'drizzle-to-sql' },
			MOCKS
		)
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.errors[0].code).toBe('empty-input')
		}
	})

	it('reports an unsupported construct with its line', function () {
		const result = runConversion(
			{
				input: 'db.select()\n\t.from(users)\n\t.having(gt(count(), 2))',
				dialect: 'postgres',
				direction: 'drizzle-to-sql'
			},
			MOCKS
		)
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.errors[0].code).toBe('unsupported-construct')
			expect(result.errors[0].line).toBe(3)
		}
	})
})
