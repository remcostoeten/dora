import { describe, expect, it } from 'vitest'
import {
	backendToFrontendConnection,
	frontendToBackendDatabaseInfo
} from '@/features/connections/api'

describe('connections/api mapping (mysql)', function () {
	it('maps frontend MySQL connection fields to backend DatabaseInfo', function () {
		expect(
			frontendToBackendDatabaseInfo({
				id: 'c1',
				name: 'MySQL',
				type: 'mysql',
				host: 'localhost',
				port: 3306,
				user: 'root',
				password: 'pass',
				database: 'mydb',
				ssl: true,
				sshConfig: {
					enabled: true,
					host: 'bastion.example.com',
					port: 22,
					username: 'deploy',
					authMethod: 'password',
					password: 'ssh-pass'
				},
				createdAt: Date.now()
			} as any)
		).toEqual({
			MySQL: {
				connection_string: 'mysql://root:pass@localhost:3306/mydb?sslmode=require',
				ssh_config: {
					host: 'bastion.example.com',
					port: 22,
					username: 'deploy',
					private_key_path: null,
					password: 'ssh-pass'
				}
			}
		})
	})

	it('maps backend MySQL connections back to the frontend shape', function () {
		expect(
			backendToFrontendConnection({
				id: 'c2',
				name: 'Replica',
				connected: true,
				database_type: {
					MySQL: {
						connection_string: 'mysql://app:secret@db.internal:3306/app_db',
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
				last_connected_at: 1710000000
			} as any)
		).toMatchObject({
			id: 'c2',
			name: 'Replica',
			type: 'mysql',
			host: 'db.internal',
			port: 3306,
			user: 'app',
			database: 'app_db',
			url: 'mysql://app:secret@db.internal:3306/app_db',
			status: 'connected',
			lastConnectedAt: 1710000000,
			sshConfig: {
				enabled: true,
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				authMethod: 'keyfile',
				privateKeyPath: '/home/app/.ssh/id_ed25519',
				password: undefined
			}
		})
	})
})
