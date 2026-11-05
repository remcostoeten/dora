import { assertTauriRuntime } from '@studio/core/platform/runtime'
import { commands, type CloudflareAccount, type CloudflareD1Database } from '@studio/lib/bindings'

export type { CloudflareAccount, CloudflareD1Database }

export async function isCloudflareConnected(): Promise<boolean> {
	assertTauriRuntime()
	return commands.cloudflareIsConnected()
}

// Validates a Cloudflare API token (by listing accounts), then stores it
// encrypted on-device. Cloudflare's REST API is token-based (Bearer), so there
// is no OAuth flow.
export async function saveCloudflareToken(token: string): Promise<void> {
	assertTauriRuntime()
	const result = await commands.cloudflareSaveToken(token)
	if (result.status === 'error') {
		throw result.error
	}
}

// The Cloudflare accounts the stored token can see — used both as the first pick
// step (D1 is account-scoped) and for the "Connected as …" label.
export async function listCloudflareAccounts(): Promise<CloudflareAccount[]> {
	assertTauriRuntime()
	const result = await commands.cloudflareListAccounts()
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

export async function listCloudflareDatabases(accountId: string): Promise<CloudflareD1Database[]> {
	assertTauriRuntime()
	const result = await commands.cloudflareListDatabases(accountId)
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

export async function getCloudflareAccount(): Promise<CloudflareAccount[]> {
	assertTauriRuntime()
	const result = await commands.cloudflareAccount()
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

export async function disconnectCloudflare(): Promise<void> {
	assertTauriRuntime()
	const result = await commands.cloudflareDisconnect()
	if (result.status === 'error') {
		throw result.error
	}
}
