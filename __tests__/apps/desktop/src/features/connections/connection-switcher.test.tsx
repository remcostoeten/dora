import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { DataProvider } from '@/core/data-provider'
import { ConnectionSwitcher } from '@/features/connections/components/connection-switcher'
import type { Connection } from '@/features/connections/types'

const connections: Connection[] = [
	{
		id: 'local-postgres',
		name: 'Local Postgres',
		type: 'postgres',
		host: 'localhost',
		database: 'app',
		status: 'connected',
		createdAt: 1_700_000_000,
		lastConnectedAt: 1_700_000_000
	},
	{
		id: 'analytics',
		name: 'Analytics',
		type: 'mysql',
		host: 'warehouse.example.com',
		database: 'analytics',
		status: 'idle',
		createdAt: 1_700_000_001,
		lastConnectedAt: null
	}
]

type Overrides = {
	onDeleteConnection?: (id: string) => void
	onEditConnection?: (id: string) => void
	onConnectionSelect?: (id: string) => void
}

function renderSwitcher(overrides?: Overrides) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false }
		}
	})

	return render(
		<QueryClientProvider client={queryClient}>
			<DataProvider forceMock>
				<ConnectionSwitcher
					connections={connections}
					activeConnectionId='local-postgres'
					onConnectionSelect={overrides?.onConnectionSelect ?? vi.fn()}
					onAddConnection={vi.fn()}
					onManageConnections={vi.fn()}
					onEditConnection={overrides?.onEditConnection}
					onDeleteConnection={overrides?.onDeleteConnection}
				/>
			</DataProvider>
		</QueryClientProvider>
	)
}

async function openMenu() {
	const user = userEvent.setup()
	const trigger = await screen.findByRole('button', {
		name: /change database connection/i
	})
	trigger.focus()
	await user.keyboard('{Enter}')
	await waitFor(function () {
		expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
	})
	return user
}

describe('ConnectionSwitcher', function () {
	it('lets keyboard users tab through the opened saved connection dropdown', async function () {
		const user = userEvent.setup()
		renderSwitcher()

		const trigger = await screen.findByRole('button', {
			name: /change database connection/i
		})

		trigger.focus()
		await user.keyboard('{Enter}')

		await waitFor(function () {
			expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
		})

		await waitFor(function () {
			expect(screen.getByRole('menuitem', { name: /local postgres/i })).toHaveFocus()
		})

		await user.tab()
		expect(screen.getByRole('menuitem', { name: /analytics/i })).toHaveFocus()

		await user.tab()
		expect(screen.getByRole('menuitem', { name: /add connection/i })).toHaveFocus()
	})

	it('keeps the dropdown open after deleting so several can be removed in a row', async function () {
		const user = userEvent.setup()
		const onDeleteConnection = vi.fn()
		renderSwitcher({ onDeleteConnection })

		const trigger = await screen.findByRole('button', {
			name: /change database connection/i
		})
		trigger.focus()
		await user.keyboard('{Enter}')

		await waitFor(function () {
			expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
		})

		await user.click(screen.getByRole('button', { name: /delete local postgres/i }))
		expect(onDeleteConnection).toHaveBeenCalledWith('local-postgres')

		await waitFor(function () {
			expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
		})

		await user.click(screen.getByRole('button', { name: /delete analytics/i }))
		expect(onDeleteConnection).toHaveBeenCalledWith('analytics')
		await waitFor(function () {
			expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
		})
	})

	it('deletes with a normal click', async function () {
		const user = userEvent.setup()
		const onDeleteConnection = vi.fn()
		renderSwitcher({ onDeleteConnection })

		const trigger = await screen.findByRole('button', {
			name: /change database connection/i
		})
		trigger.focus()
		await user.keyboard('{Enter}')

		await waitFor(function () {
			expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
		})

		await user.click(screen.getByRole('button', { name: /delete local postgres/i }))

		expect(onDeleteConnection).toHaveBeenCalledOnce()
		expect(onDeleteConnection).toHaveBeenCalledWith('local-postgres')
	})

	it('mounts one context menu for the whole list instead of one per row', async function () {
		renderSwitcher({ onEditConnection: vi.fn() })
		await openMenu()

		expect(document.querySelectorAll('[data-connection-id]')).toHaveLength(2)
		expect(document.querySelectorAll('[data-slot="context-menu-trigger"]')).toHaveLength(1)
	})

	it('opens the row actions for the connection that was right-clicked', async function () {
		const onEditConnection = vi.fn()
		renderSwitcher({ onEditConnection })
		const user = await openMenu()

		fireEvent.contextMenu(screen.getByRole('menuitem', { name: /analytics/i }))
		await user.click(await screen.findByRole('menuitem', { name: /edit connection/i }))

		expect(onEditConnection).toHaveBeenCalledOnce()
		expect(onEditConnection).toHaveBeenCalledWith('analytics')
		expect(screen.queryByPlaceholderText('Search connections...')).not.toBeInTheDocument()
	})

	it('shows no row actions for a right-click outside a row', async function () {
		renderSwitcher({ onEditConnection: vi.fn() })
		await openMenu()

		const list = document.querySelector('[data-slot="context-menu-trigger"]')
		expect(list).not.toBeNull()
		if (list) fireEvent.contextMenu(list)

		expect(screen.queryByRole('menuitem', { name: /edit connection/i })).not.toBeInTheDocument()
	})

	it('unmounts the menu in the commit that closes it and forgets the search', async function () {
		renderSwitcher()
		const user = await openMenu()

		const search = screen.getByPlaceholderText('Search connections...')
		await user.type(search, 'analy')
		expect(search).toHaveValue('analy')
		expect(search).toHaveFocus()
		expect(document.querySelectorAll('[data-connection-id]')).toHaveLength(1)

		await user.keyboard('{Escape}')
		expect(screen.queryByPlaceholderText('Search connections...')).not.toBeInTheDocument()

		await openMenu()
		expect(screen.getByPlaceholderText('Search connections...')).toHaveValue('')
		expect(document.querySelectorAll('[data-connection-id]')).toHaveLength(2)
	})

	it('selects a connection and closes without waiting for an exit animation', async function () {
		const onConnectionSelect = vi.fn()
		renderSwitcher({ onConnectionSelect })
		const user = await openMenu()

		await user.click(screen.getByRole('menuitem', { name: /analytics/i }))

		expect(onConnectionSelect).toHaveBeenCalledWith('analytics')
		expect(screen.queryByPlaceholderText('Search connections...')).not.toBeInTheDocument()
	})

	it('keeps Escape from reaching window level shortcut listeners', async function () {
		const onWindowKeyDown = vi.fn()
		window.addEventListener('keydown', onWindowKeyDown)
		renderSwitcher()
		const user = await openMenu()
		onWindowKeyDown.mockClear()

		await user.keyboard('{Escape}')

		expect(onWindowKeyDown).not.toHaveBeenCalled()
		window.removeEventListener('keydown', onWindowKeyDown)
	})

	it('does not re-render when its parent re-renders with the same props', async function () {
		let nameReads = 0
		const probed: Connection[] = [
			Object.defineProperty({ ...connections[0] }, 'name', {
				enumerable: true,
				get() {
					nameReads += 1
					return 'Local Postgres'
				}
			}),
			connections[1]
		]
		const handlers = {
			onConnectionSelect: vi.fn(),
			onAddConnection: vi.fn(),
			onManageConnections: vi.fn()
		}
		const queryClient = new QueryClient()
		function Harness({ tick }: { tick: number }) {
			return (
				<QueryClientProvider client={queryClient}>
					<DataProvider forceMock>
						<span data-tick={tick} />
						<ConnectionSwitcher
							connections={probed}
							activeConnectionId='local-postgres'
							{...handlers}
						/>
					</DataProvider>
				</QueryClientProvider>
			)
		}

		const view = render(<Harness tick={0} />)
		await screen.findByRole('button', { name: /change database connection/i })
		const baseline = nameReads

		view.rerender(<Harness tick={1} />)
		view.rerender(<Harness tick={2} />)

		expect(nameReads).toBe(baseline)
	})
})
