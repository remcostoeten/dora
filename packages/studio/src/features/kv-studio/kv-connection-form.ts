import type { SshAuthMethod } from '@studio/features/connections/types'
import type { KvConnectionConfig } from '@studio/lib/bindings'

export type KvConnectionForm = {
	name: string
	url: string
	skipTlsVerify: boolean
	sshOn: boolean
	sshHost: string
	sshPort: string
	sshUser: string
	sshAuth: SshAuthMethod
	sshKeyPath: string
	sshPassword: string
	sshFingerprint: string
}

export const EMPTY_KV_FORM: KvConnectionForm = {
	name: 'Local Redis',
	url: 'redis://127.0.0.1:6379/0',
	skipTlsVerify: false,
	sshOn: false,
	sshHost: '',
	sshPort: '22',
	sshUser: '',
	sshAuth: 'keyfile',
	sshKeyPath: '',
	sshPassword: '',
	sshFingerprint: ''
}

export function usesTls(url: string): boolean {
	return url.trim().toLowerCase().startsWith('rediss://')
}

/**
 * @name toKvConnectionConfig
 * @description Turns the KV connection form into the config the backend stores, dropping SSH fields when the tunnel is off.
 * @example
 * toKvConnectionConfig({ ...EMPTY_KV_FORM, url: 'rediss://default:pw@cache.example.com:6379' })
 */
export function toKvConnectionConfig(form: KvConnectionForm): KvConnectionConfig {
	const url = form.url.trim()
	return {
		url,
		skipTlsVerify: usesTls(url) && form.skipTlsVerify,
		sshTunnel: form.sshOn
			? {
					host: form.sshHost.trim(),
					port: Number(form.sshPort) || 22,
					username: form.sshUser.trim(),
					private_key_path:
						form.sshAuth === 'keyfile' ? form.sshKeyPath.trim() || null : null,
					password: form.sshAuth === 'password' ? form.sshPassword || null : null,
					host_key_fingerprint: form.sshFingerprint.trim() || null
				}
			: null
	}
}

/**
 * @name describeKvTarget
 * @description Masks credentials in a stored KV config and names the SSH hop, for display.
 * @example
 * describeKvTarget({ url: 'redis://:pw@10.0.0.4:6379', skipTlsVerify: false, sshTunnel: null })
 */
export function describeKvTarget(config: KvConnectionConfig): string {
	// Replaces the user:password@ part of the URL.
	const url = config.url.replace(/:\/\/[^@/]+@/, '://••••@')
	const tunnel = config.sshTunnel
	return tunnel ? `${url} via ${tunnel.username}@${tunnel.host}` : url
}
