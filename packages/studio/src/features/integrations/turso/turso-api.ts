import { assertTauriRuntime } from '@studio/core/platform/runtime'
import { commands, type TursoDatabase, type TursoOrganization } from '@studio/lib/bindings'

export type { TursoDatabase, TursoOrganization }

export async function isTursoConnected(): Promise<boolean> {
	assertTauriRuntime()
	return commands.tursoIsConnected()
}

// Validates a Turso Platform API token (by listing organizations), then stores
// it encrypted on-device. Turso's API is token-based, so there's no OAuth flow.
export async function saveTursoToken(token: string): Promise<void> {
	assertTauriRuntime()
	const result = await commands.tursoSaveToken(token)
	if (result.status === 'error') {
		throw result.error
	}
}

// Whether the local Turso CLI is installed (macOS/Linux). Gates the one-click
// "mint with the CLI" affordance — falls back to manual paste when absent.
export async function isTursoCliAvailable(): Promise<boolean> {
	assertTauriRuntime()
	return commands.tursoCliAvailable()
}

// Mints a Platform API token via the local Turso CLI (running `turso auth
// login` first if needed), then validates and stores it on-device. This can
// block while the user completes the browser login.
export async function mintTursoToken(): Promise<void> {
	assertTauriRuntime()
	const result = await commands.tursoMintToken()
	if (result.status === 'error') {
		throw result.error
	}
}

export async function listTursoDatabases(): Promise<TursoDatabase[]> {
	assertTauriRuntime()
	const result = await commands.tursoListDatabases()
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

// Mints a full-access database auth token (JWT) for a database. This is the
// credential stored on the connection — the user never copies a secret.
export async function createTursoToken(
	organizationSlug: string,
	databaseName: string
): Promise<string> {
	assertTauriRuntime()
	const result = await commands.tursoCreateToken(organizationSlug, databaseName)
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

export async function installTursoCli(): Promise<void> {
	assertTauriRuntime()
	const result = await commands.tursoInstallCli()
	if (result.status === 'error') {
		throw result.error
	}
}

// Whether the user is signed in to the local Turso CLI. Gates whether we offer
// "mint a token" (signed in) or "sign in to Turso" (signed out).
export async function isTursoCliLoggedIn(): Promise<boolean> {
	assertTauriRuntime()
	return commands.tursoCliLoggedIn()
}

// Runs `turso auth login` (opens a browser) so the user can authenticate
// without leaving Dora. Blocks until the browser flow finishes.
export async function loginTursoCli(): Promise<void> {
	assertTauriRuntime()
	const result = await commands.tursoCliLogin()
	if (result.status === 'error') {
		throw result.error
	}
}

// The organizations the stored token can access — used to show which Turso
// account the connection is authenticated as.
export async function getTursoAccount(): Promise<TursoOrganization[]> {
	assertTauriRuntime()
	const result = await commands.tursoAccount()
	if (result.status === 'error') {
		throw result.error
	}
	return result.data
}

export async function disconnectTurso(): Promise<void> {
	assertTauriRuntime()
	const result = await commands.tursoDisconnect()
	if (result.status === 'error') {
		throw result.error
	}
}

// libsql connection URL for a database hostname. Turso reports a bare host
// (e.g. `my-db-acme.turso.io`); the client connects over the libsql scheme and
// authenticates with the minted token.
export function buildTursoConnectionUrl(hostname: string): string {
	return `libsql://${hostname}`
}
