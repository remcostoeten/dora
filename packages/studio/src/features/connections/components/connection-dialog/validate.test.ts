import { describe, expect, it } from 'vitest'
import { blankForm, type FormState } from './model'
import { summarizeErrors, validateDetails } from './validate'

function form(overrides: Partial<FormState>): FormState {
	return { ...blankForm(), ...overrides }
}

describe('validateDetails', () => {
	it('requires a host and a sane port for server fields', () => {
		expect(validateDetails('postgres', form({}), 'x', 'test')).toEqual({
			host: 'Host is required.'
		})
		expect(
			validateDetails('postgres', form({ host: 'h', port: 'abc' }), 'x', 'test').port
		).toBe('Use a number.')
		expect(
			validateDetails('postgres', form({ host: 'h', port: '70000' }), 'x', 'test').port
		).toBe('Between 1 and 65535.')
	})

	it('accepts a complete connection string and rejects a partial one', () => {
		const ok = form({ useString: true, connStr: 'postgres://u:p@h/db' })
		expect(validateDetails('postgres', ok, 'x', 'test')).toEqual({})
		const partial = form({ useString: true, connStr: 'postgres://' })
		expect(validateDetails('postgres', partial, 'x', 'test').connStr).toBe(
			"This isn't a complete connection URL."
		)
	})

	it('validates the SSH tunnel only when it is on', () => {
		const off = form({ host: 'h' })
		expect(validateDetails('postgres', off, 'x', 'test')).toEqual({})
		const on = form({ host: 'h', sshOn: true, sshAuth: 'keyfile' })
		expect(validateDetails('postgres', on, 'x', 'test')).toEqual({
			sshHost: 'SSH host is required.',
			sshUser: 'Username is required.',
			sshKeyPath: 'Choose a private key file.'
		})
	})

	it('catches a DuckDB file chosen for SQLite', () => {
		expect(validateDetails('sqlite', form({ path: '/a/b.duckdb' }), 'x', 'test').path).toMatch(
			/DuckDB/
		)
		expect(validateDetails('sqlite', form({}), 'x', 'test').path).toBe(
			'Choose a database file.'
		)
	})

	it('requires a token for Turso hosts', () => {
		const errors = validateDetails(
			'libsql',
			form({ url: 'libsql://db-org.turso.io' }),
			'x',
			'test'
		)
		expect(errors.token).toBe('Turso databases need an auth token.')
		expect(validateDetails('libsql', form({ url: 'ftp://nope' }), 'x', 'test').url).toBe(
			'Start with libsql:// or https://.'
		)
	})

	it('asks for a name only when saving', () => {
		const filled = form({ host: 'h' })
		expect(validateDetails('postgres', filled, ' ', 'test')).toEqual({})
		expect(validateDetails('postgres', filled, ' ', 'save')).toEqual({
			name: 'Give the connection a name.'
		})
	})
})

describe('summarizeErrors', () => {
	it('returns the message for one error and a count for several', () => {
		expect(summarizeErrors({ host: 'Host is required.' }, 'save')).toBe('Host is required.')
		expect(summarizeErrors({ host: 'a', name: 'b' }, 'save')).toBe(
			'Fix 2 fields before saving: Host, Name.'
		)
		expect(summarizeErrors({ host: 'a', port: 'b' }, 'test')).toBe(
			'Fix 2 fields before testing: Host, Port.'
		)
	})
})
