import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '../../types'
import { detect } from './detect'
import {
	createDialogStore,
	effectiveName,
	kindOfSource,
	type DialogDeps,
	type TestOutcome
} from './store'

function setup(options: { original?: Connection; outcome?: TestOutcome; tauri?: boolean } = {}) {
	const onSave = vi.fn()
	const testConnection = vi.fn(
		async (): Promise<TestOutcome> => options.outcome ?? { kind: 'ok' }
	)
	const deps = {
		current: {
			onSave,
			isTauri: () => options.tauri ?? true,
			testConnection
		} satisfies DialogDeps
	}
	const store = createDialogStore({ original: options.original ?? null, deps })
	return { store, onSave, testConnection, state: () => store.getState() }
}

const saved: Connection = {
	id: 'c1',
	name: 'shop',
	type: 'postgres',
	host: 'db',
	user: 'app',
	database: 'shop',
	createdAt: 1
}

function foundUrl(text: string) {
	const found = detect(text)
	if (!found) throw new Error('not detected')
	return found
}

describe('dialog store', () => {
	it('starts on the source step, or on details when editing', () => {
		expect(setup().state()).toMatchObject({ step: 'source', source: null })
		expect(setup({ original: saved }).state()).toMatchObject({
			step: 'details',
			source: 'postgres',
			nameTouched: true
		})
	})

	it('moves to details with localhost prefilled for a server engine', () => {
		const { state } = setup()
		state().chooseSource('postgres')
		expect(state()).toMatchObject({ step: 'details', source: 'postgres' })
		expect(state().form.host).toBe('localhost')
		expect(state().focusRequest?.target).toBe('host')
	})

	it('fills the form from a pasted URL and asks for the missing password', () => {
		const { state } = setup()
		const applied = state().applyDetection(
			foundUrl('postgres://app@ep-1.us-east-2.aws.neon.tech/shop?sslmode=require'),
			'url'
		)
		expect(applied).toBe(true)
		expect(state()).toMatchObject({
			step: 'details',
			source: 'postgres',
			via: 'Neon',
			filledFrom: 'url'
		})
		expect(state().form).toMatchObject({
			host: 'ep-1.us-east-2.aws.neon.tech',
			user: 'app',
			database: 'shop',
			ssl: true
		})
		expect(state().focusRequest?.target).toBe('password')
		expect(effectiveName(state())).toBe('shop (Neon)')
	})

	it('focuses the token after a libSQL URL without one', () => {
		const { state } = setup()
		state().applyDetection(foundUrl('libsql://shop-edge.turso.io'), 'url')
		expect(state()).toMatchObject({
			source: 'libsql',
			form: expect.objectContaining({ url: 'libsql://shop-edge.turso.io' })
		})
		expect(state().focusRequest?.target).toBe('token')
	})

	it('refuses detections it cannot apply', () => {
		const { state } = setup()
		expect(state().applyDetection({ kind: 'datafile', path: './a.csv' }, 'url')).toBe(false)
		expect(state().step).toBe('source')
	})

	it('goes back to the source step but not while editing', () => {
		const create = setup()
		create.state().chooseSource('mysql')
		create.state().back()
		expect(create.state().step).toBe('source')

		const edit = setup({ original: saved })
		edit.state().back()
		expect(edit.state().step).toBe('details')
	})

	it('shows every error and asks to focus the first one when saving an empty form', async () => {
		const { state, onSave } = setup()
		state().chooseSource('postgres')
		state().setField('host', '')
		await state().save()
		expect(state().errors).toMatchObject({
			host: 'Host is required.',
			name: 'Give the connection a name.'
		})
		expect(state().alert).toBe('Fix 2 fields before saving: Host, Name.')
		expect(state().focusRequest?.target).toBe('host')
		expect(onSave).not.toHaveBeenCalled()
	})

	it('clears an error and the alert when its field is edited', async () => {
		const { state } = setup()
		state().chooseSource('postgres')
		state().setField('host', '')
		await state().save()
		state().setField('host', 'db')
		state().setName('shop')
		expect(state().errors).toEqual({})
		expect(state().alert).toBeNull()
	})

	it('asks before saving an untested connection, then saves on confirmation', async () => {
		const { state, onSave } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		await state().save()
		expect(state().confirmSave).toBe(true)
		expect(onSave).not.toHaveBeenCalled()

		await state().saveAnyway()
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'postgres', host: 'db.acme.io', name: 'postgres@db' })
		)
		expect(state().saving).toBe(false)
		expect(state().confirmSave).toBe(false)
	})

	it('saves straight away after a passing test and marks the test stale on edits', async () => {
		const { state, onSave, testConnection } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		expect(await state().runTest()).toBe(true)
		expect(state().test.name).toBe('success')
		expect(testConnection).toHaveBeenCalledOnce()

		await state().save()
		expect(onSave).toHaveBeenCalledOnce()

		state().setField('database', 'other')
		expect(state().testStale).toBe(true)
		await state().save()
		expect(state().confirmSave).toBe(true)
	})

	it('tests, then saves, from the confirmation bar', async () => {
		const { state, onSave } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		await state().save()
		await state().testAndSave()
		expect(onSave).toHaveBeenCalledOnce()
	})

	it('keeps the failure message and does not save after a failed test and save', async () => {
		const { state, onSave } = setup({
			outcome: { kind: 'failed', message: 'password authentication failed' }
		})
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		await state().save()
		await state().testAndSave()
		expect(state().test).toEqual({ name: 'error', message: 'password authentication failed' })
		expect(onSave).not.toHaveBeenCalled()
	})

	it('reports desktop-only instead of testing outside the app', async () => {
		const { state, testConnection } = setup({ tauri: false })
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		expect(await state().runTest()).toBe(false)
		expect(state().test.name).toBe('desktop-only')
		expect(testConnection).not.toHaveBeenCalled()
	})

	it('ignores the result of a test that a later edit cancelled', async () => {
		let release: (outcome: TestOutcome) => void = () => {}
		const onSave = vi.fn()
		const testConnection = vi.fn(
			() =>
				new Promise<TestOutcome>((resolve) => {
					release = resolve
				})
		)
		const store = createDialogStore({
			original: null,
			deps: { current: { onSave, isTauri: () => true, testConnection } }
		})
		store.getState().chooseSource('postgres')
		store.getState().setField('host', 'db.acme.io')
		const running = store.getState().runTest()
		store.getState().setField('host', 'changed')
		release({ kind: 'ok' })
		await running
		expect(store.getState().test.name).toBe('idle')
		expect(store.getState().testStale).toBe(true)
	})

	it('saves an unchanged saved connection without asking for a test', async () => {
		const { state, onSave } = setup({ original: saved })
		await state().save()
		expect(onSave).toHaveBeenCalledOnce()
		expect(state().confirmSave).toBe(false)
	})

	it('asks for a test once the saved details change, but not for a rename', async () => {
		const rename = setup({ original: saved })
		rename.state().setName('renamed')
		await rename.state().save()
		expect(rename.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'renamed' }))

		const changed = setup({ original: saved })
		changed.state().setField('host', 'other')
		await changed.state().save()
		expect(changed.state().confirmSave).toBe(true)
	})

	it('converts between fields and connection string without losing details', () => {
		const { state } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		state().setField('user', 'app')
		state().setField('database', 'shop')
		state().setUseString(true)
		expect(state().form.connStr).toContain('app@db.acme.io')

		state().setField('connStr', 'postgresql://other:pw@elsewhere.io:5433/analytics')
		state().setUseString(false)
		expect(state().form).toMatchObject({
			host: 'elsewhere.io',
			port: '5433',
			user: 'other',
			database: 'analytics'
		})
	})

	it('switches engine and provider when a different URL is typed into the string field', () => {
		const { state } = setup()
		state().chooseSource('postgres')
		state().setUseString(true)
		state().setField('connStr', 'mysql://u:p@aws.connect.psdb.cloud/orders')
		expect(state()).toMatchObject({ source: 'mysql', via: 'PlanetScale' })
	})

	it('points a Fly.io host at the local proxy', () => {
		const { state } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'acme-db.fly.dev')
		state().switchToFlyProxy()
		expect(state().form).toMatchObject({ host: 'localhost', port: '5432', ssl: false })
		expect(state().via).toBe('fly proxy')
	})

	it('keeps a typed name over the suggestion', () => {
		const { state } = setup()
		state().chooseSource('postgres')
		state().setField('host', 'db.acme.io')
		expect(effectiveName(state())).toBe('postgres@db')
		state().setName('Production')
		state().setField('host', 'other.io')
		expect(effectiveName(state())).toBe('Production')
	})
})

describe('kindOfSource', () => {
	it('classifies sources and managed saved connections', () => {
		expect(kindOfSource('postgres', null)).toBe('server')
		expect(kindOfSource('sqlite', null)).toBe('file')
		expect(kindOfSource('libsql', null)).toBe('libsql')
		expect(kindOfSource('neon', null)).toBe('provider')
		expect(kindOfSource('d1', { ...saved, type: 'd1' })).toBe('managed')
		expect(kindOfSource('duckdb', { ...saved, type: 'duckdb', fileSources: ['/a.csv'] })).toBe(
			'managed'
		)
	})
})
