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

function renderSwitcher(overrides?: { onDeleteConnection?: (id: string) => void }) {
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
					onConnectionSelect={vi.fn()}
					onAddConnection={vi.fn()}
					onManageConnections={vi.fn()}
					onDeleteConnection={overrides?.onDeleteConnection}
				/>
			</DataProvider>
		</QueryClientProvider>
	)
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

		fireEvent.click(screen.getByRole('button', { name: /delete local postgres/i }))
		expect(onDeleteConnection).toHaveBeenCalledWith('local-postgres')

		expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: /delete analytics/i }))
		expect(onDeleteConnection).toHaveBeenCalledWith('analytics')
		expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
	})
})
