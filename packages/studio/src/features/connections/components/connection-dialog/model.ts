import type { DatabaseType, SshAuthMethod } from '../../types'

export type IntegrationKey =
	| 'supabase'
	| 'turso'
	| 'neon'
	| 'cloudflare'
	| 'xata'
	| 'planetscale'
	| 'vercel'
	| 'posthog'

export type ServerEngine = 'postgres' | 'mysql' | 'mariadb' | 'cockroach'

export type SourceId = DatabaseType | IntegrationKey

export type SourceKind = 'server' | 'file' | 'libsql' | 'provider' | 'managed'

export type Step = 'source' | 'details'

export type FilledFrom = 'url' | 'drop'

export type FormState = {
	host: string
	port: string
	user: string
	password: string
	database: string
	ssl: boolean
	pooler: boolean
	useString: boolean
	connStr: string
	path: string
	url: string
	token: string
	sshOn: boolean
	sshHost: string
	sshPort: string
	sshUser: string
	sshAuth: SshAuthMethod
	sshPassword: string
	sshKeyPath: string
	sshFingerprint: string
	clearSavedPassword: boolean
}

export type FormKey = keyof FormState

export type ErrorKey = FormKey | 'name' | 'prov'

export type Errors = Partial<Record<ErrorKey, string>>

export type TestPhase =
	| { name: 'idle' }
	| { name: 'testing' }
	| { name: 'success'; ms: number }
	| { name: 'error'; message: string }
	| { name: 'desktop-only' }

export const SERVER_ENGINES: readonly ServerEngine[] = ['postgres', 'mysql', 'mariadb', 'cockroach']

export const SSH_ERROR_KEYS: readonly FormKey[] = [
	'sshHost',
	'sshUser',
	'sshKeyPath',
	'sshPassword'
]

export const FIELD_LABELS: Record<ErrorKey, string> = {
	host: 'Host',
	port: 'Port',
	user: 'User',
	password: 'Password',
	database: 'Database',
	ssl: 'SSL',
	pooler: 'Pooler mode',
	useString: 'Connection mode',
	connStr: 'Connection string',
	path: 'Database file',
	url: 'Database URL',
	token: 'Auth token',
	sshOn: 'SSH tunnel',
	sshHost: 'SSH host',
	sshPort: 'SSH port',
	sshUser: 'SSH user',
	sshAuth: 'SSH authentication',
	sshPassword: 'SSH password',
	sshKeyPath: 'Private key',
	sshFingerprint: 'Host key fingerprint',
	clearSavedPassword: 'Saved password',
	name: 'Name',
	prov: 'Account'
}

export function isServerEngine(type: SourceId): type is ServerEngine {
	return (SERVER_ENGINES as readonly string[]).includes(type)
}

export function blankForm(): FormState {
	return {
		host: '',
		port: '',
		user: '',
		password: '',
		database: '',
		ssl: false,
		pooler: false,
		useString: false,
		connStr: '',
		path: '',
		url: '',
		token: '',
		sshOn: false,
		sshHost: '',
		sshPort: '22',
		sshUser: '',
		sshAuth: 'keyfile',
		sshPassword: '',
		sshKeyPath: '',
		sshFingerprint: '',
		clearSavedPassword: false
	}
}
