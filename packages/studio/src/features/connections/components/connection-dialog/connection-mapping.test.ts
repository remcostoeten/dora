import { describe, expect, it } from 'vitest'
import type { Connection } from '../../types'
import { frontendToBackendDatabaseInfo } from '../../utils/mapping'
import {
	buildConnectionStringFromForm,
	connectionToForm,
	formToConnection,
	serverParams,
	suggestName
} from './connection-mapping'
import { blankForm, type FormState } from './model'

function form(overrides: Partial<FormState>): FormState {
	return { ...blankForm(), ...overrides }
}

const saved: Connection = {
	id: 'c1',
	name: 'shop',
	type: 'postgres',
	host: 'db.acme.internal',
	port: 5433,
	user: 'app',
	database: 'shop',
	ssl: true,
	poolerMode: true,
	createdAt: 1,
	sshConfig: {
		enabled: true,
		host: 'bastion',
		port: 2222,
		username: 'deploy',
		authMethod: 'keyfile',
		privateKeyPath: '~/.ssh/id'
	}
}

describe('formToConnection', () => {
	it('maps server fields and leaves blanks to the engine defaults', () => {
		const connection = formToConnection(
			'postgres',
			' shop ',
			form({ host: ' db ', port: '', ssl: true }),
			null
		)
		expect(connection).toMatchObject({
			name: 'shop',
			type: 'postgres',
			host: 'db',
			port: undefined,
			user: undefined,
			ssl: true,
			poolerMode: false
		})
		expect(connection.url).toBeUndefined()
	})

	it('uses the connection string in string mode', () => {
		const connection = formToConnection(
			'mysql',
			'm',
			form({ useString: true, connStr: 'DATABASE_URL="mysql://u:p@h/db"' }),
			null
		)
		expect(connection.url).toBe('mysql://u:p@h/db')
		expect(connection.host).toBeUndefined()
	})

	it('sends the ssh tunnel with its auth method and disabled state', () => {
		const on = formToConnection(
			'postgres',
			'a',
			form({ host: 'h', sshOn: true, sshHost: 'b', sshUser: 'u', sshKeyPath: '/k' }),
			null
		)
		expect(on.sshConfig).toMatchObject({
			enabled: true,
			authMethod: 'keyfile',
			privateKeyPath: '/k',
			password: undefined
		})
		const off = formToConnection('postgres', 'a', form({ host: 'h' }), null)
		expect(off.sshConfig?.enabled).toBe(false)
	})

	it('maps file and libSQL sources', () => {
		expect(formToConnection('sqlite', 'f', form({ path: ' /a.db ' }), null)).toMatchObject({
			type: 'sqlite',
			url: '/a.db'
		})
		expect(
			formToConnection(
				'libsql',
				'l',
				form({ url: 'libsql://x.turso.io', token: ' t ' }),
				null
			)
		).toMatchObject({
			type: 'libsql',
			url: 'libsql://x.turso.io',
			authToken: 't'
		})
	})

	it('keeps a managed connection intact apart from its name', () => {
		const managed: Connection = { ...saved, type: 'd1', url: 'https://d1', createdAt: 5 }
		const next = formToConnection('d1', ' renamed ', blankForm(), managed)
		expect(next).toMatchObject({ type: 'd1', url: 'https://d1', name: 'renamed' })
		expect('id' in next).toBe(false)
		expect('createdAt' in next).toBe(false)
	})

	it('produces a payload the backend mapper accepts', () => {
		const connection = formToConnection(
			'postgres',
			'a',
			form({ host: 'h', user: 'u', database: 'd', ssl: true }),
			null
		)
		const info = frontendToBackendDatabaseInfo({ ...connection, id: 'x', createdAt: 0 })
		expect(info).toHaveProperty('Postgres.connection_string')
	})
})

describe('connectionToForm', () => {
	it('loads fields, pooler and ssh from a saved connection', () => {
		const loaded = connectionToForm(saved)
		expect(loaded).toMatchObject({
			host: 'db.acme.internal',
			port: '5433',
			user: 'app',
			database: 'shop',
			ssl: true,
			pooler: true,
			useString: false,
			sshOn: true,
			sshHost: 'bastion',
			sshPort: '2222',
			sshAuth: 'keyfile',
			sshKeyPath: '~/.ssh/id'
		})
	})

	it('opens url connections in string mode', () => {
		const loaded = connectionToForm({ ...saved, host: undefined, url: 'postgres://u:p@h/db' })
		expect(loaded).toMatchObject({ useString: true, connStr: 'postgres://u:p@h/db' })
	})
})

describe('serverParams and connection strings', () => {
	it('falls back to engine defaults', () => {
		expect(serverParams('mysql', form({ host: 'h' }))).toMatchObject({
			port: '3306',
			user: 'root',
			database: 'mysql'
		})
	})

	it('renders ssl and pooler into the string', () => {
		const url = buildConnectionStringFromForm(
			'postgres',
			form({ host: 'h', user: 'u', database: 'd', ssl: true, pooler: true })
		)
		expect(url).toContain('sslmode=require')
		expect(url).toContain('simple_query=true')
	})
})

describe('suggestName', () => {
	it('names server connections from database and host', () => {
		expect(suggestName('postgres', form({ host: 'db.acme.io', database: 'shop' }), null)).toBe(
			'shop@db'
		)
		expect(suggestName('postgres', form({ host: 'localhost', database: 'shop' }), null)).toBe(
			'shop (local)'
		)
		expect(
			suggestName('postgres', form({ host: 'x.neon.tech', database: 'shop' }), 'Neon')
		).toBe('shop (Neon)')
		expect(suggestName('postgres', form({}), null)).toBe('')
	})

	it('names files and libSQL from their location', () => {
		expect(suggestName('sqlite', form({ path: '/a/b/dev.db' }), null)).toBe('dev.db')
		expect(suggestName('libsql', form({ url: 'libsql://shop-edge.turso.io' }), null)).toBe(
			'shop-edge'
		)
	})
})
