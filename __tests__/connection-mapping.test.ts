import { describe, expect, it } from 'vitest'
import type { Connection } from '@/features/connections/types'
import { frontendToBackendDatabaseInfo, frontendToBackendSshConfig } from '@/features/connections/utils/mapping'

describe('connection mapping', function () {
	it('preserves ssh config for postgres connections', function () {
		const connection = {
			id: 'conn-1',
			name: 'pg',
			type: 'postgres',
			host: 'localhost',
			port: 5432,
			user: 'postgres',
			database: 'postgres',
			sshConfig: {
				enabled: true,
				host: 'jump.example.com',
				port: 22,
				username: 'admin',
				authMethod: 'password',
				password: 'secret'
			}
		} as Connection

		expect(frontendToBackendSshConfig(connection)).toEqual({
			host: 'jump.example.com',
			port: 22,
			username: 'admin',
			private_key_path: null,
			password: 'secret',
			host_key_fingerprint: null
		})

		expect(frontendToBackendDatabaseInfo(connection)).toEqual({
			Postgres: {
				connection_string: 'postgresql://postgres@localhost:5432/postgres',
				ssh_config: {
					host: 'jump.example.com',
					port: 22,
					username: 'admin',
					private_key_path: null,
					password: 'secret',
					host_key_fingerprint: null
				}
			}
		})
	})

	it('preserves ssh config for mysql connections', function () {
		const connection = {
			id: 'conn-2',
			name: 'mysql',
			type: 'mysql',
			host: 'localhost',
			port: 3306,
			user: 'root',
			database: 'dora',
			sshConfig: {
				enabled: true,
				host: 'jump.example.com',
				port: 22,
				username: 'admin',
				authMethod: 'keyfile',
				privateKeyPath: '/keys/id_ed25519'
			}
		} as Connection

		expect(frontendToBackendSshConfig(connection)).toEqual({
			host: 'jump.example.com',
			port: 22,
			username: 'admin',
			private_key_path: '/keys/id_ed25519',
			password: null,
			host_key_fingerprint: null
		})
	})
})
