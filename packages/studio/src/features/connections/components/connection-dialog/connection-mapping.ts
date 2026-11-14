import type { Connection, SshTunnelConfig } from '../../types'
import {
	PROVIDER_CONFIGS,
	buildConnectionString,
	sanitizeConnectionUrl
} from '../../utils/providers'
import { detect } from './detect'
import {
	blankForm,
	isServerEngine,
	type FormState,
	type ServerEngine,
	type SourceId
} from './model'

export type NewConnection = Omit<Connection, 'id' | 'createdAt'>

type ServerParams = {
	host: string
	port: string
	user: string
	password: string
	database: string
	ssl: boolean
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/

function trimmedOrUndefined(value: string): string | undefined {
	const trimmed = value.trim()
	return trimmed === '' ? undefined : trimmed
}

function sshConfigFrom(form: FormState): SshTunnelConfig {
	const keyfile = form.sshAuth === 'keyfile'
	return {
		enabled: form.sshOn,
		host: form.sshHost.trim(),
		port: Number.parseInt(form.sshPort, 10) || 22,
		username: form.sshUser.trim(),
		authMethod: form.sshAuth,
		password: keyfile ? undefined : form.sshPassword,
		privateKeyPath: keyfile ? form.sshKeyPath.trim() : undefined,
		hostKeyFingerprint: trimmedOrUndefined(form.sshFingerprint)
	}
}

/**
 * @name serverParams
 * @description Resolves the effective host, port, user and database of a
 * server form, reading the connection string when that mode is active and
 * falling back to the engine defaults for anything left blank.
 *
 * @example
 * serverParams('postgres', form).port // "5432" when the port is blank
 */
export function serverParams(source: ServerEngine, form: FormState): ServerParams {
	const defaults = PROVIDER_CONFIGS[source]
	const fallbackPort = String(defaults.defaultPort)

	if (form.useString) {
		const found = detect(form.connStr)
		if (found?.kind === 'url') {
			return {
				host: found.host,
				port: found.port || fallbackPort,
				user: found.user || defaults.defaultUser,
				password: found.password,
				database: found.database || defaults.defaultDatabase,
				ssl: found.ssl
			}
		}
		return {
			host: '',
			port: fallbackPort,
			user: defaults.defaultUser,
			password: '',
			database: defaults.defaultDatabase,
			ssl: form.ssl
		}
	}

	return {
		host: form.host.trim(),
		port: form.port.trim() || fallbackPort,
		user: form.user.trim() || defaults.defaultUser,
		password: form.password,
		database: form.database.trim() || defaults.defaultDatabase,
		ssl: form.ssl
	}
}

/**
 * @name buildConnectionStringFromForm
 * @description Renders the field values of a server form as a connection URL,
 * including the SSL and pooler flags, so the two input modes stay in sync.
 *
 * @example
 * buildConnectionStringFromForm('postgres', form) // "postgresql://app@db:5432/shop"
 */
export function buildConnectionStringFromForm(source: ServerEngine, form: FormState): string {
	const params = serverParams(source, form)
	const url = buildConnectionString({
		type: source,
		host: params.host || 'localhost',
		port: Number.parseInt(params.port, 10),
		user: params.user,
		password: params.password || undefined,
		database: params.database,
		ssl: params.ssl
	})
	if (source === 'postgres' && form.pooler && !url.includes('simple_query=')) {
		return url + (url.includes('?') ? '&' : '?') + 'simple_query=true'
	}
	return url
}

/**
 * @name suggestName
 * @description Proposes a connection name from the details entered so far,
 * so the name never has to be typed for the common case.
 *
 * @example
 * suggestName('postgres', form, 'Neon') // "shop (Neon)"
 */
export function suggestName(source: SourceId, form: FormState, via: string | null): string {
	if (isServerEngine(source)) {
		const params = serverParams(source, form)
		if (!params.host) return ''
		if (via) return `${params.database} (${via})`
		if (LOCAL_HOST.test(params.host)) return `${params.database} (local)`
		return `${params.database}@${params.host.split('.')[0]}`
	}
	if (source === 'sqlite' || source === 'duckdb') {
		return form.path ? (form.path.split(/[\\/]/).pop() ?? '') : ''
	}
	if (source === 'libsql') {
		return form.url ? (form.url.replace(/^[a-z]+:\/\//i, '').split(/[./?]/)[0] ?? '') : ''
	}
	return ''
}

/**
 * @name formToConnection
 * @description Turns the dialog state into the connection payload the host
 * saves and the test command runs, so what is tested is exactly what is saved.
 *
 * @example
 * const connection = formToConnection('postgres', 'shop', form, null)
 */
export function formToConnection(
	source: SourceId,
	name: string,
	form: FormState,
	original: Connection | null
): NewConnection {
	const base = { name: name.trim() }

	if (isServerEngine(source)) {
		const ssh = sshConfigFrom(form)
		const pooler = source === 'postgres' ? form.pooler : false
		const common = {
			...base,
			type: source,
			poolerMode: pooler,
			sshConfig: ssh,
			clearSavedPassword: original ? form.clearSavedPassword : undefined
		}
		if (form.useString) {
			return { ...common, url: sanitizeConnectionUrl(form.connStr) }
		}
		const port = Number.parseInt(form.port, 10)
		return {
			...common,
			host: trimmedOrUndefined(form.host),
			port: Number.isNaN(port) ? undefined : port,
			user: trimmedOrUndefined(form.user),
			password: form.password === '' ? undefined : form.password,
			database: trimmedOrUndefined(form.database),
			ssl: form.ssl
		}
	}

	if (source === 'sqlite' || source === 'duckdb') {
		return { ...base, type: source, url: form.path.trim() }
	}

	if (source === 'libsql') {
		return {
			...base,
			type: 'libsql',
			url: form.url.trim(),
			authToken: trimmedOrUndefined(form.token)
		}
	}

	if (!original) throw new Error(`Source ${source} is created through its connect flow`)
	const { id: _id, createdAt: _createdAt, ...rest } = original
	return { ...rest, name: base.name }
}

/**
 * @name connectionToForm
 * @description Loads a saved connection into the dialog form state for editing.
 *
 * @example
 * const form = connectionToForm(savedConnection)
 */
export function connectionToForm(connection: Connection): FormState {
	const form = blankForm()
	const ssh = connection.sshConfig

	if (ssh) {
		form.sshOn = ssh.enabled
		form.sshHost = ssh.host
		form.sshPort = String(ssh.port || 22)
		form.sshUser = ssh.username
		form.sshAuth = ssh.authMethod
		form.sshPassword = ssh.password ?? ''
		form.sshKeyPath = ssh.privateKeyPath ?? ''
		form.sshFingerprint = ssh.hostKeyFingerprint ?? ''
	}

	if (isServerEngine(connection.type)) {
		form.pooler = !!connection.poolerMode
		if (connection.url) {
			form.useString = true
			form.connStr = connection.url
			return form
		}
		form.host = connection.host ?? ''
		form.port = connection.port ? String(connection.port) : ''
		form.user = connection.user ?? ''
		form.password = connection.password ?? ''
		form.database = connection.database ?? ''
		form.ssl = !!connection.ssl
		return form
	}

	if (connection.type === 'sqlite' || connection.type === 'duckdb') {
		form.path = connection.url ?? ''
	} else if (connection.type === 'libsql') {
		form.url = connection.url ?? ''
		form.token = connection.authToken ?? ''
	}
	return form
}
