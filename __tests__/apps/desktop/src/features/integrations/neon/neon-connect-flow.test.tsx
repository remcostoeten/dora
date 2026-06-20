import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NeonConnectFlow } from '@studio/features/integrations/neon/neon-connect-flow'
import {
	createNeonConnectionUri,
	isNeonConnected
} from '@studio/features/integrations/neon/neon-api'

vi.mock('@tauri-apps/plugin-shell', () => ({
	open: vi.fn()
}))

vi.mock('@studio/core/data-provider', () => ({
	useIsTauri: () => true
}))

vi.mock('@studio/features/integrations/neon/neon-api', () => ({
	isNeonConnected: vi.fn().mockResolvedValue(false),
	saveNeonToken: vi.fn(),
	createNeonConnectionUri: vi.fn().mockResolvedValue('postgres://neon.example/db'),
	disconnectNeon: vi.fn(),
	getNeonAccount: vi.fn().mockResolvedValue({ email: 'dev@example.com', name: 'Dev' }),
	listNeonBranches: vi.fn().mockResolvedValue([])
}))

vi.mock('@studio/features/integrations/neon/use-neon-databases', () => ({
	useNeonDatabases: () => ({
		databases: [
			{
				projectId: 'superlis',
				projectName: 'superlis',
				branchId: 'br-main',
				databaseName: 'neondb',
				roleName: 'owner'
			}
		],
		isLoading: false,
		error: null,
		refresh: vi.fn(),
		reset: vi.fn()
	})
}))

// Branch list the picker reads; mutated per-test to exercise single- vs
// multi-branch projects without re-rendering the whole flow by hand.
let branchesForTest: Array<{ id: string; name: string; isDefault: boolean }> = []

vi.mock('@studio/features/integrations/neon/use-neon-branches', () => ({
	useNeonBranches: () => ({
		branches: branchesForTest,
		isLoading: false,
		error: null
	})
}))

describe('NeonConnectFlow', function () {
	beforeEach(function () {
		branchesForTest = []
		vi.mocked(createNeonConnectionUri).mockClear()
	})

	it('copies the Neon API key URL when the external link helper is used', async function () {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		})

		render(<NeonConnectFlow onComplete={vi.fn()} />)

		await userEvent.click(screen.getByRole('button', { name: /copy url here/i }))

		expect(writeText).toHaveBeenCalledWith('https://console.neon.tech/app/settings/api-keys')
		expect(screen.getByText('Copied')).toBeInTheDocument()
	})

	it('keeps the create action in a sticky action bar after a database is selected', async function () {
		vi.mocked(isNeonConnected).mockResolvedValueOnce(true)
		const onComplete = vi.fn()

		render(<NeonConnectFlow onComplete={onComplete} />)

		await userEvent.click(await screen.findByRole('button', { name: /neondb/i }))

		const createButton = screen.getByRole('button', { name: /create neon connection/i })
		expect(createButton.closest('[data-neon-action-bar]')).toHaveClass('sticky')

		await userEvent.click(createButton)
		expect(createNeonConnectionUri).toHaveBeenCalled()
	})

	it('shows a branch picker for multi-branch projects and connects to the chosen branch', async function () {
		vi.mocked(isNeonConnected).mockResolvedValueOnce(true)
		branchesForTest = [
			{ id: 'br-main', name: 'main', isDefault: true },
			{ id: 'br-preview', name: 'preview/pr-123', isDefault: false }
		]
		const onComplete = vi.fn()

		render(<NeonConnectFlow onComplete={onComplete} />)

		await userEvent.click(await screen.findByRole('button', { name: /neondb/i }))

		// Both branches surface; the primary is labeled.
		const previewBranch = await screen.findByRole('button', { name: /preview\/pr-123/i })
		expect(screen.getByRole('button', { name: /main.*primary/i })).toBeInTheDocument()

		await userEvent.click(previewBranch)
		await userEvent.click(screen.getByRole('button', { name: /create neon connection/i }))

		// The non-primary branch id is threaded into the URI minter and labels
		// the connection.
		expect(createNeonConnectionUri).toHaveBeenCalledWith(
			expect.objectContaining({ databaseName: 'neondb' }),
			'br-preview'
		)
		expect(onComplete).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'superlis · preview/pr-123' })
		)
	})

	it('keeps the one-step flow (no branch picker) for single-branch projects', async function () {
		vi.mocked(isNeonConnected).mockResolvedValueOnce(true)
		branchesForTest = [{ id: 'br-main', name: 'main', isDefault: true }]

		render(<NeonConnectFlow onComplete={vi.fn()} />)

		await userEvent.click(await screen.findByRole('button', { name: /neondb/i }))

		expect(screen.queryByText('Branch')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: /create neon connection/i })).toBeInTheDocument()
	})
})
