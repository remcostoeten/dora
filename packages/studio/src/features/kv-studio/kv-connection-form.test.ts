import { describe, expect, it } from 'vitest'
import { describeKvTarget, EMPTY_KV_FORM, toKvConnectionConfig } from './kv-connection-form'

describe('toKvConnectionConfig', function () {
	it('keeps a plain URL without TLS or tunnel options', function () {
		expect(toKvConnectionConfig({ ...EMPTY_KV_FORM, skipTlsVerify: true })).toEqual({
			url: 'redis://127.0.0.1:6379/0',
			skipTlsVerify: false,
			sshTunnel: null
		})
	})

	it('only skips verification for rediss URLs', function () {
		const config = toKvConnectionConfig({
			...EMPTY_KV_FORM,
			url: '  rediss://default:pw@cache.example.com:6379 ',
			skipTlsVerify: true
		})
		expect(config.url).toBe('rediss://default:pw@cache.example.com:6379')
		expect(config.skipTlsVerify).toBe(true)
	})

	it('sends only the chosen SSH credential', function () {
		const form = {
			...EMPTY_KV_FORM,
			sshOn: true,
			sshHost: ' bastion.example.com ',
			sshPort: '',
			sshUser: 'ec2-user',
			sshKeyPath: '~/.ssh/id_ed25519',
			sshPassword: 'secret'
		}
		expect(toKvConnectionConfig(form).sshTunnel).toEqual({
			host: 'bastion.example.com',
			port: 22,
			username: 'ec2-user',
			private_key_path: '~/.ssh/id_ed25519',
			password: null,
			host_key_fingerprint: null
		})
		expect(toKvConnectionConfig({ ...form, sshAuth: 'password' }).sshTunnel).toMatchObject({
			private_key_path: null,
			password: 'secret'
		})
	})
})

describe('describeKvTarget', function () {
	it('masks credentials and names the SSH hop', function () {
		const config = toKvConnectionConfig({
			...EMPTY_KV_FORM,
			url: 'redis://:pw@10.0.0.4:6379',
			sshOn: true,
			sshHost: 'bastion',
			sshUser: 'deploy'
		})
		expect(describeKvTarget(config)).toBe('redis://••••@10.0.0.4:6379 via deploy@bastion')
	})
})
