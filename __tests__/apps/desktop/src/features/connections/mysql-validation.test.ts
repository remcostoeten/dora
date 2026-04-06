import { describe, expect, it } from 'vitest'
import { validateConnection } from '@/features/connections/validation'

describe('connections validation (mysql)', function () {
	it('accepts a valid MySQL connection string with SSH tunnel config', function () {
		expect(
			validateConnection(
				{
					name: 'MySQL',
					type: 'mysql',
					url: 'mysql://user:pass@localhost:3306/mydb',
					sshConfig: {
						enabled: true,
						host: 'bastion.example.com',
						port: 22,
						username: 'deploy',
						authMethod: 'keyfile',
						privateKeyPath: '/home/app/.ssh/id_ed25519'
					}
				},
				true
			)
		).toEqual({ success: true })
	})

	it('accepts valid MySQL connection fields', function () {
		expect(
			validateConnection(
				{
					name: 'MySQL',
					type: 'mysql',
					host: 'localhost',
					port: 3306,
					user: 'root',
					password: 'pass',
					database: 'mydb',
					ssl: false
				},
				false
			)
		).toEqual({ success: true })
	})

	it('rejects invalid MySQL SSH tunnel configs', function () {
		const result = validateConnection(
			{
				name: 'MySQL',
				type: 'mysql',
				host: 'localhost',
				port: 3306,
				user: 'root',
				password: 'pass',
				database: 'mydb',
				sshConfig: {
					enabled: true,
					host: 'bastion.example.com',
					port: 22,
					username: 'deploy',
					authMethod: 'password'
				}
			},
			false
		)

		expect(result.success).toBe(false)
		expect(result.field).toBe('password')
	})

	it('rejects invalid MySQL connection string formats', function () {
		const result = validateConnection(
			{
				name: 'MySQL',
				type: 'mysql',
				url: 'postgresql://user:pass@localhost:5432/mydb'
			},
			true
		)
		expect(result.success).toBe(false)
	})
})
