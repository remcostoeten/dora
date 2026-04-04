import { describe, expect, it } from 'vitest'
import { sshTunnelSchema, validateConnection } from '@/features/connections/validation'

describe('connections validation', function () {
	it('accepts valid SSH tunnel configs for password and keyfile auth', function () {
		expect(
			sshTunnelSchema.safeParse({
				enabled: true,
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				authMethod: 'password',
				password: 'hunter2'
			}).success
		).toBe(true)

		expect(
			sshTunnelSchema.safeParse({
				enabled: true,
				host: 'bastion.example.com',
				port: 2222,
				username: 'deploy',
				authMethod: 'keyfile',
				privateKeyPath: '/home/app/.ssh/id_ed25519'
			}).success
		).toBe(true)
	})

	it('rejects SSH tunnel configs that are missing the auth secret for the selected method', function () {
		expect(
			sshTunnelSchema.safeParse({
				enabled: true,
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				authMethod: 'password'
			}).success
		).toBe(false)

		expect(
			sshTunnelSchema.safeParse({
				enabled: true,
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				authMethod: 'keyfile'
			}).success
		).toBe(false)
	})

	it('continues to validate Postgres connection fields when SSH config is present', function () {
		expect(
			validateConnection(
				{
					name: 'Prod Postgres',
					type: 'postgres',
					host: 'db.internal',
					port: 5432,
					user: 'app',
					password: 'secret',
					database: 'app_db',
					ssl: true,
					sshConfig: {
						enabled: true,
						host: 'bastion.example.com',
						port: 22,
						username: 'deploy',
						authMethod: 'password',
						password: 'hunter2'
					}
				},
				false
			)
		).toEqual({ success: true })
	})
})
