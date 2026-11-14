import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Connection, DatabaseType } from '../../types'
import { PROVIDER_CONFIGS } from '../../utils/providers'
import {
	buildConnectionStringFromForm,
	connectionToForm,
	formToConnection,
	suggestName,
	type NewConnection
} from './connection-mapping'
import { detect, type Detection, type UrlDetection } from './detect'
import {
	SSH_ERROR_KEYS,
	blankForm,
	isServerEngine,
	type ErrorKey,
	type Errors,
	type FilledFrom,
	type FormKey,
	type FormState,
	type SourceId,
	type SourceKind,
	type Step,
	type TestPhase
} from './model'
import { isIntegration } from './sources'
import { summarizeErrors, validateDetails, type ValidationScope } from './validate'

export type TestOutcome =
	| { kind: 'ok' }
	| { kind: 'failed'; message: string }
	| { kind: 'desktop-only' }

export type DialogDeps = {
	onSave: (connection: NewConnection) => void | Promise<void>
	isTauri: () => boolean
	testConnection: (connection: NewConnection, editingId: string | null) => Promise<TestOutcome>
}

export type FocusTarget = ErrorKey | 'omni' | 'test-btn' | 'save-btn' | 'confirm-primary'

export type FocusRequest = { target: FocusTarget; nonce: number }

export type DialogState = {
	original: Connection | null
	step: Step
	source: SourceId | null
	via: string | null
	filledFrom: FilledFrom | null
	query: string
	form: FormState
	name: string
	nameTouched: boolean
	errors: Errors
	alert: string | null
	test: TestPhase
	testStale: boolean
	detailsDirty: boolean
	confirmSave: boolean
	saving: boolean
	sslWhy: string
	focusRequest: FocusRequest | null
}

export type DialogActions = {
	setQuery: (query: string) => void
	chooseSource: (id: SourceId) => void
	applyDetection: (detection: Detection, from: FilledFrom) => boolean
	applyDatabaseFile: (engine: 'sqlite' | 'duckdb', path: string) => void
	back: () => void
	setField: <Key extends FormKey>(key: Key, value: FormState[Key]) => void
	setName: (name: string) => void
	setUseString: (useString: boolean) => void
	switchToFlyProxy: () => void
	runTest: () => Promise<boolean>
	save: () => Promise<void>
	saveAnyway: () => Promise<void>
	testAndSave: () => Promise<void>
	cancelConfirm: () => void
	requestFocus: (target: FocusTarget) => void
}

export type DialogStore = StoreApi<DialogState & DialogActions>

type Params = {
	original: Connection | null
	deps: { current: DialogDeps }
}

const FOCUS_ORDER: readonly ErrorKey[] = [
	'host',
	'port',
	'user',
	'password',
	'database',
	'connStr',
	'path',
	'url',
	'token',
	'sshHost',
	'sshUser',
	'sshKeyPath',
	'sshPassword',
	'name',
	'prov'
]

const FORM_KEYS_BY_MODE: readonly FormKey[] = ['host', 'port', 'connStr', 'password']

let focusNonce = 0

function focusRequest(target: FocusTarget): FocusRequest {
	focusNonce += 1
	return { target, nonce: focusNonce }
}

/**
 * @name kindOfSource
 * @description Classifies a source into the form it needs. Saved connections
 * of types that have no editable details (D1, PostHog, data-file sessions)
 * are managed, and only their name can change.
 *
 * @example
 * kindOfSource('postgres', null) // 'server'
 */
export function kindOfSource(source: SourceId, original: Connection | null): SourceKind {
	if (original && (original.type === 'd1' || original.type === 'posthog')) return 'managed'
	if (original?.fileSources && original.fileSources.length > 0) return 'managed'
	if (isServerEngine(source)) return 'server'
	if (source === 'sqlite' || source === 'duckdb') return 'file'
	if (source === 'libsql') return 'libsql'
	return isIntegration(source) ? 'provider' : 'managed'
}

/**
 * @name effectiveName
 * @description The name shown in the name field and saved: what the user typed
 * once they touched the field, the suggestion derived from the details until then.
 *
 * @example
 * const name = effectiveName(store.getState())
 */
export function effectiveName(state: DialogState): string {
	if (state.nameTouched || !state.source) return state.name
	return suggestName(state.source, state.form, state.via)
}

function firstFieldOf(source: SourceId, useString: boolean): FocusTarget | null {
	if (isServerEngine(source)) return useString ? 'connStr' : 'host'
	if (source === 'sqlite' || source === 'duckdb') return 'path'
	if (source === 'libsql') return 'url'
	return null
}

function firstInvalid(errors: Errors): ErrorKey | null {
	return FOCUS_ORDER.find((key) => errors[key] !== undefined) ?? null
}

function withoutKey(errors: Errors, key: ErrorKey): Errors {
	if (errors[key] === undefined) return errors
	const next = { ...errors }
	delete next[key]
	return next
}

function carriedSsh(form: FormState): Partial<FormState> {
	return {
		sshOn: form.sshOn,
		sshHost: form.sshHost,
		sshPort: form.sshPort,
		sshUser: form.sshUser,
		sshAuth: form.sshAuth,
		sshPassword: form.sshPassword,
		sshKeyPath: form.sshKeyPath,
		sshFingerprint: form.sshFingerprint
	}
}

function initialState(original: Connection | null): DialogState {
	const base: DialogState = {
		original,
		step: 'source',
		source: null,
		via: null,
		filledFrom: null,
		query: '',
		form: blankForm(),
		name: '',
		nameTouched: false,
		errors: {},
		alert: null,
		test: { name: 'idle' },
		testStale: false,
		detailsDirty: true,
		confirmSave: false,
		saving: false,
		sslWhy: '',
		focusRequest: null
	}
	if (!original) return base
	return {
		...base,
		step: 'details',
		source: original.type,
		form: connectionToForm(original),
		name: original.name,
		nameTouched: true,
		detailsDirty: false,
		focusRequest: focusRequest(firstFieldOf(original.type, !!original.url) ?? 'name')
	}
}

function parsedFields(found: UrlDetection): Partial<FormState> {
	return {
		host: found.host,
		port: found.port,
		user: found.user,
		password: found.password,
		database: found.database,
		ssl: found.ssl
	}
}

function togglePoolerInUrl(url: string, enabled: boolean): string {
	if (enabled) return url + (url.includes('?') ? '&' : '?') + 'simple_query=true'
	return url.replace(/([?&])simple_query=true&?/, '$1').replace(/[?&]$/, '')
}

/**
 * @name createDialogStore
 * @description Creates the state container for one opening of the connection
 * dialog. Components read it through narrow selectors, so typing in one field
 * re-renders that field and nothing else.
 *
 * @example
 * const store = createDialogStore({ original: null, deps })
 * store.getState().chooseSource('postgres')
 */
export function createDialogStore({ original, deps }: Params): DialogStore {
	let runId = 0

	return createStore<DialogState & DialogActions>()((set, get) => {
		function staleAfterEdit(): Partial<DialogState> {
			const state = get()
			const patch: Partial<DialogState> = { detailsDirty: true }
			if (state.test.name === 'testing') {
				runId += 1
				return { ...patch, test: { name: 'idle' }, testStale: true }
			}
			if (state.test.name === 'success' || state.test.name === 'error') {
				return { ...patch, testStale: true }
			}
			return patch
		}

		function clearErrors(): Partial<DialogState> {
			return { errors: {}, alert: null }
		}

		function showErrors(errors: Errors, scope: ValidationScope) {
			const first = firstInvalid(errors)
			set({
				errors,
				alert: summarizeErrors(errors, scope),
				confirmSave: false,
				focusRequest: first ? focusRequest(first) : null
			})
		}

		function draft(): NewConnection | null {
			const state = get()
			if (!state.source) return null
			return formToConnection(state.source, effectiveName(state), state.form, state.original)
		}

		function currentErrors(scope: ValidationScope): Errors {
			const state = get()
			if (!state.source) return {}
			return validateDetails(state.source, state.form, effectiveName(state), scope)
		}

		function syncFromConnectionString(form: FormState) {
			const found = detect(form.connStr)
			if (found?.kind !== 'url' || !isServerEngine(found.engine))
				return { form, switched: null }
			const next = { ...form, ...parsedFields(found), pooler: found.pooler || form.pooler }
			const state = get()
			const changed =
				!state.original && (found.engine !== state.source || found.provider !== state.via)
			return {
				form: next,
				switched: changed ? { source: found.engine, via: found.provider } : null
			}
		}

		return {
			...initialState(original),

			setQuery: (query) => set({ query }),

			requestFocus: (target) => set({ focusRequest: focusRequest(target) }),

			chooseSource: (id) => {
				const state = get()
				const previous = state.source
				let form = state.form
				let via = state.via
				let filledFrom = state.filledFrom
				let sslWhy = state.sslWhy

				if (previous !== id) {
					const wasServer = previous !== null && isServerEngine(previous)
					if (isServerEngine(id) && wasServer) {
						const oldPort = String(
							PROVIDER_CONFIGS[previous as DatabaseType].defaultPort
						)
						form = { ...form, port: form.port === oldPort ? '' : form.port }
					} else if (isServerEngine(id)) {
						form = { ...blankForm(), ...carriedSsh(form), host: 'localhost' }
					} else {
						form = blankForm()
					}
					via = null
					filledFrom = null
					sslWhy = ''
				}

				const focus = firstFieldOf(id, form.useString)
				set({
					source: id,
					via,
					filledFrom,
					sslWhy,
					form:
						isServerEngine(id) && form.useString
							? { ...form, connStr: buildConnectionStringFromForm(id, form) }
							: form,
					query: '',
					step: 'details',
					test: { name: 'idle' },
					testStale: false,
					detailsDirty: true,
					confirmSave: false,
					...clearErrors(),
					focusRequest: focus ? focusRequest(focus) : null
				})
			},

			applyDetection: (detection, from) => {
				const state = get()
				let source: SourceId
				let form: FormState = blankForm()
				let via: string | null = null
				let sslWhy = ''
				let focus: FocusTarget | null = 'test-btn'

				if (detection.kind === 'file') {
					source = detection.engine
					form.path = detection.path
				} else if (detection.kind === 'url' && detection.engine === 'libsql') {
					source = 'libsql'
					form.url = `libsql://${detection.host}`
					form.token = detection.token
					via = detection.provider
					focus = detection.token ? 'test-btn' : 'token'
				} else if (
					(detection.kind === 'url' || detection.kind === 'partial') &&
					isServerEngine(detection.engine)
				) {
					source = detection.engine
					form = { ...blankForm(), ...carriedSsh(state.form) }
					if (detection.kind === 'url') {
						form = {
							...form,
							...parsedFields(detection),
							pooler: detection.pooler && detection.engine === 'postgres',
							connStr: detection.raw
						}
						via = detection.provider
						sslWhy = detection.sslWhy
						focus = detection.password ? 'test-btn' : 'password'
					} else {
						form.port = String(PROVIDER_CONFIGS[detection.engine].defaultPort)
						focus = 'host'
					}
				} else {
					return false
				}

				set({
					source,
					form,
					via,
					sslWhy,
					filledFrom: from,
					query: '',
					nameTouched: false,
					name: '',
					step: 'details',
					test: { name: 'idle' },
					testStale: false,
					detailsDirty: true,
					confirmSave: false,
					...clearErrors(),
					focusRequest: focus ? focusRequest(focus) : null
				})
				return true
			},

			applyDatabaseFile: (engine, path) => {
				get().applyDetection({ kind: 'file', engine, path }, 'drop')
			},

			back: () => {
				const state = get()
				if (state.original || state.step !== 'details') return
				runId += 1
				set({
					step: 'source',
					query: '',
					confirmSave: false,
					test: state.test.name === 'testing' ? { name: 'idle' } : state.test,
					focusRequest: focusRequest('omni')
				})
			},

			setField: (key, value) => {
				const state = get()
				if (!state.source) return
				let form: FormState = { ...state.form, [key]: value }
				const patch: Partial<DialogState> = { ...staleAfterEdit() }
				let errors = withoutKey(state.errors, key)

				if (key === 'sshOn' && value === false) {
					for (const sshKey of SSH_ERROR_KEYS) {
						errors = withoutKey(errors, sshKey)
					}
				}

				if (key === 'connStr') {
					const synced = syncFromConnectionString(form)
					form = synced.form
					if (synced.switched) {
						patch.source = synced.switched.source
						patch.via = synced.switched.via
					}
				}

				if (key === 'ssl') {
					patch.sslWhy = ''
					if (form.useString && isServerEngine(state.source)) {
						form = {
							...form,
							connStr: buildConnectionStringFromForm(state.source, form)
						}
					}
				}

				if (key === 'pooler' && form.useString && detect(form.connStr)?.kind === 'url') {
					form = { ...form, connStr: togglePoolerInUrl(form.connStr, value === true) }
				}

				patch.errors = errors
				if (Object.keys(errors).length === 0) patch.alert = null
				patch.form = form
				set(patch)
			},

			setName: (name) => {
				const state = get()
				set({
					name,
					nameTouched: true,
					errors: withoutKey(state.errors, 'name'),
					alert:
						Object.keys(withoutKey(state.errors, 'name')).length === 0
							? null
							: state.alert
				})
			},

			setUseString: (useString) => {
				const state = get()
				if (
					!state.source ||
					!isServerEngine(state.source) ||
					useString === state.form.useString
				)
					return
				let form = state.form
				if (useString) {
					form = {
						...form,
						useString,
						connStr: buildConnectionStringFromForm(state.source, form)
					}
				} else {
					const found = detect(form.connStr)
					form = {
						...form,
						useString,
						...(found?.kind === 'url' ? parsedFields(found) : {})
					}
				}
				let errors = state.errors
				for (const key of FORM_KEYS_BY_MODE) errors = withoutKey(errors, key)
				set({
					form,
					errors,
					alert: Object.keys(errors).length === 0 ? null : state.alert,
					...staleAfterEdit()
				})
			},

			switchToFlyProxy: () => {
				const state = get()
				if (!state.source || !isServerEngine(state.source)) return
				let form: FormState = { ...state.form, host: 'localhost', port: '5432', ssl: false }
				if (form.useString)
					form = { ...form, connStr: buildConnectionStringFromForm(state.source, form) }
				set({
					form,
					via: 'fly proxy',
					sslWhy: '',
					errors: withoutKey(state.errors, 'host'),
					...staleAfterEdit(),
					focusRequest: focusRequest('host')
				})
			},

			runTest: async () => {
				const state = get()
				if (!state.source) return false
				if (!deps.current.isTauri()) {
					set({ test: { name: 'desktop-only' }, testStale: false })
					return false
				}
				const errors = currentErrors('test')
				if (Object.keys(errors).length > 0) {
					showErrors(errors, 'test')
					return false
				}
				const connection = draft()
				if (!connection) return false

				runId += 1
				const id = runId
				set({ test: { name: 'testing' }, testStale: false, ...clearErrors() })
				const startedAt = performance.now()
				const outcome = await deps.current.testConnection(
					connection,
					state.original?.id ?? null
				)
				if (id !== runId) return false

				if (outcome.kind === 'ok') {
					set({
						test: { name: 'success', ms: Math.round(performance.now() - startedAt) }
					})
					return true
				}
				if (outcome.kind === 'desktop-only') {
					set({ test: { name: 'desktop-only' } })
					return false
				}
				set({ test: { name: 'error', message: outcome.message } })
				return false
			},

			save: async () => {
				const state = get()
				if (state.saving || state.step !== 'details' || !state.source) return
				const errors = currentErrors('save')
				if (Object.keys(errors).length > 0) {
					showErrors(errors, 'save')
					return
				}
				const verified = state.test.name === 'success' && !state.testStale
				if (state.detailsDirty && !verified) {
					set({ confirmSave: true, focusRequest: focusRequest('confirm-primary') })
					return
				}
				await get().saveAnyway()
			},

			saveAnyway: async () => {
				const connection = draft()
				if (!connection || get().saving) return
				set({ confirmSave: false, saving: true, focusRequest: focusRequest('save-btn') })
				try {
					await deps.current.onSave(connection)
				} finally {
					set({ saving: false })
				}
			},

			testAndSave: async () => {
				set({ confirmSave: false, focusRequest: focusRequest('test-btn') })
				const passed = await get().runTest()
				if (passed) await get().saveAnyway()
			},

			cancelConfirm: () => set({ confirmSave: false, focusRequest: focusRequest('save-btn') })
		}
	})
}
