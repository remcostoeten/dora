import { describe, expect, it } from 'vitest'
import {
	backendToFrontendConnection,
	frontendToBackendDatabaseInfo
} from '@/features/connections/utils/mapping'

describe('connections/api SSH mapping', function () {
	it('round-trips Postgres SSH tunnel config from frontend to backend and back', function () {
		const frontendConnection = {
			id: 'conn-1',
			name: 'Prod Postgres',
			type: 'postgres',
			host: 'db.internal',
			port: 5432,
			user: 'app',
			password: 'secret',
			database: 'app_db',
			ssl: true,
			url: undefined,
			authToken: undefined,
			status: 'idle',
			createdAt: Date.now(),
			sshConfig: {
				enabled: true,
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				authMethod: 'keyfile',
				privateKeyPath: '/home/app/.ssh/id_ed25519'
			}
		} as const

		const backendDatabaseInfo = frontendToBackendDatabaseInfo(frontendConnection as any)
		expect(backendDatabaseInfo).toEqual({
			Postgres: {
				connection_string:
					'postgresql://app:secret@db.internal:5432/app_db?sslmode=require',
				ssh_config: {
					host: 'bastion.example.com',
					port: 22,
					username: 'deploy',
					private_key_path: '/home/app/.ssh/id_ed25519',
					password: null
				}
			}
		})

		const roundTrippedConnection = backendToFrontendConnection({
			id: 'conn-1',
			name: 'Prod Postgres',
			connected: false,
			database_type: {
				Postgres: {
					connection_string:
						'postgresql://app:secret@db.internal:5432/app_db?sslmode=require',
					ssh_config: {
						host: 'bastion.example.com',
						port: 22,
						username: 'deploy',
						private_key_path: '/home/app/.ssh/id_ed25519',
						password: null
					}
				}
			},
			created_at: Date.now(),
			last_connected_at: null
		} as any)

		expect(roundTrippedConnection.sshConfig).toEqual({
			enabled: true,
			host: 'bastion.example.com',
			port: 22,
			username: 'deploy',
			authMethod: 'keyfile',
			privateKeyPath: '/home/app/.ssh/id_ed25519',
			password: undefined
		})
	})
})
