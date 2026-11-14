import { Profiler, type ReactNode } from 'react'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './fields'
import { createDialogStore, type DialogDeps } from './store'
import { DialogStoreProvider } from './store-context'
import { ConnectionDialogFooter } from './dialog-footer'

vi.mock('@studio/core/data-provider', () => ({
	useIsTauri: () => true
}))

function renderCounts() {
	const counts: Record<string, number> = {}
	function Probe({ id, children }: { id: string; children: ReactNode }) {
		return (
			<Profiler
				id={id}
				onRender={() => {
					counts[id] = (counts[id] ?? 0) + 1
				}}
			>
				{children}
			</Profiler>
		)
	}
	return { counts, Probe }
}

function mount() {
	const deps = {
		current: {
			onSave: vi.fn(),
			isTauri: () => true,
			testConnection: vi.fn(async () => ({ kind: 'ok' as const }))
		} satisfies DialogDeps
	}
	const store = createDialogStore({ original: null, deps })
	store.getState().chooseSource('postgres')
	const { counts, Probe } = renderCounts()

	render(
		<DialogStoreProvider value={store}>
			<Probe id='footer'>
				<ConnectionDialogFooter onCancel={vi.fn()} />
			</Probe>
			<Probe id='host'>
				<TextField name='host' label='Host' />
			</Probe>
			<Probe id='port'>
				<TextField name='port' label='Port' />
			</Probe>
			<Probe id='user'>
				<TextField name='user' label='User' />
			</Probe>
		</DialogStoreProvider>
	)
	return { store, counts }
}

describe('connection dialog render invariants', () => {
	it('re-renders only the field being typed in', async () => {
		const { counts } = mount()
		const before = { ...counts }

		const host = document.getElementById('cd-host')
		if (!(host instanceof HTMLInputElement)) throw new Error('host input missing')
		await userEvent.clear(host)
		await userEvent.type(host, 'db.acme.io')

		expect(counts.host).toBeGreaterThan(before.host)
		expect(counts.port).toBe(before.port)
		expect(counts.user).toBe(before.user)
		expect(counts.footer).toBe(before.footer)
	})

	it('does not re-render fields when unrelated state moves', () => {
		const { store, counts } = mount()
		const before = { ...counts }

		act(() => {
			store.getState().setName('Production')
			store.setState({ saving: true })
			store.setState({ test: { name: 'testing' } })
		})

		expect(counts.host).toBe(before.host)
		expect(counts.port).toBe(before.port)
		expect(counts.user).toBe(before.user)
	})

	it('re-renders a field only when its own error appears', () => {
		const { store, counts } = mount()
		const before = { ...counts }

		act(() => {
			store.setState({ errors: { port: 'Use a number.' } })
		})

		expect(counts.port).toBeGreaterThan(before.port)
		expect(counts.host).toBe(before.host)
		expect(counts.user).toBe(before.user)
	})
})
