import { detect } from './detect'
import {
	FIELD_LABELS,
	isServerEngine,
	type Errors,
	type ErrorKey,
	type FormState,
	type SourceId
} from './model'

export type ValidationScope = 'test' | 'save'

const MAX_PORT = 65535
const LIBSQL_URL = /^(libsql|https?|wss?):\/\//i
const TURSO_HOST = /turso\.(io|tech)/i

function validateSsh(form: FormState, errors: Errors) {
	if (!form.sshOn) return
	if (!form.sshHost.trim()) errors.sshHost = 'SSH host is required.'
	if (!form.sshUser.trim()) errors.sshUser = 'Username is required.'
	if (form.sshAuth === 'keyfile' && !form.sshKeyPath.trim()) {
		errors.sshKeyPath = 'Choose a private key file.'
	}
	if (form.sshAuth === 'password' && !form.sshPassword) {
		errors.sshPassword = 'Enter the SSH password.'
	}
}

function validateServer(form: FormState, errors: Errors) {
	if (form.useString) {
		if (!form.connStr.trim()) {
			errors.connStr = 'Paste or type a connection string.'
		} else if (detect(form.connStr)?.kind !== 'url') {
			errors.connStr = "This isn't a complete connection URL."
		}
	} else {
		if (!form.host.trim()) errors.host = 'Host is required.'
		const port = form.port.trim()
		if (port && !/^\d+$/.test(port)) errors.port = 'Use a number.'
		else if (port && (Number(port) < 1 || Number(port) > MAX_PORT)) {
			errors.port = `Between 1 and ${MAX_PORT}.`
		}
	}
	validateSsh(form, errors)
}

/**
 * @name validateDetails
 * @description Checks the details step for the active source and returns the
 * error message of every invalid field, keyed by field. The name is only
 * required when saving.
 *
 * @example
 * const errors = validateDetails('postgres', form, '', 'save')
 * if (errors.name) focusField('name')
 */
export function validateDetails(
	source: SourceId,
	form: FormState,
	name: string,
	scope: ValidationScope
): Errors {
	const errors: Errors = {}

	if (isServerEngine(source)) {
		validateServer(form, errors)
	} else if (source === 'sqlite' || source === 'duckdb') {
		if (!form.path.trim()) errors.path = 'Choose a database file.'
		else if (source === 'sqlite' && /\.duckdb$/i.test(form.path)) {
			errors.path = 'This is a DuckDB file. Change the source to DuckDB.'
		}
	} else if (source === 'libsql') {
		const url = form.url.trim()
		if (!url) errors.url = 'Database URL is required.'
		else if (!LIBSQL_URL.test(url)) errors.url = 'Start with libsql:// or https://.'
		if (TURSO_HOST.test(url) && !form.token.trim()) {
			errors.token = 'Turso databases need an auth token.'
		}
	}

	if (scope === 'save' && !name.trim()) errors.name = 'Give the connection a name.'
	return errors
}

/**
 * @name summarizeErrors
 * @description Produces the single alert line for a set of field errors: the
 * message itself for one error, a count and the field names for several.
 *
 * @example
 * summarizeErrors({ host: 'Host is required.' }, 'save') // "Host is required."
 */
export function summarizeErrors(errors: Errors, scope: ValidationScope): string {
	const keys = Object.keys(errors) as ErrorKey[]
	if (keys.length === 1) return errors[keys[0]] ?? ''
	const names = keys.map((key) => FIELD_LABELS[key])
	return `Fix ${keys.length} fields before ${scope === 'test' ? 'testing' : 'saving'}: ${names.join(', ')}.`
}
