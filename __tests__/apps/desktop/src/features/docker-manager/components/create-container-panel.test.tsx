import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CreateContainerPanel } from '@/features/docker-manager/components/create-container-panel'
import type { DatabaseProvider } from '@/features/docker-manager/types'

vi.mock('@/features/docker-manager/utilities/port-utils', () => ({
	findFreePort: async (preferred: number) => preferred
}))

async function renderPanel(initialProvider: DatabaseProvider) {
	const onSubmit = vi.fn()

	render(
		<CreateContainerPanel
			onClose={vi.fn()}
			onSubmit={onSubmit}
			existingContainers={[]}
			initialProvider={initialProvider}
		/>
	)

	await waitFor(() => {
		expect(screen.getByRole('button', { name: 'Find free port' })).toBeEnabled()
	})

	return onSubmit
}

describe('CreateContainerPanel', () => {
	it('keeps the SQL credential fields and ephemeral default for Postgres', async () => {
		await renderPanel('postgres')

		expect(screen.getByLabelText('PostgreSQL Version')).toBeInTheDocument()
		expect(screen.getByLabelText('Username')).toBeInTheDocument()
		expect(screen.getByLabelText('Password')).toBeInTheDocument()
		expect(screen.getByLabelText('Database Name')).toBeInTheDocument()
		expect(screen.getByRole('switch', { name: /ephemeral storage/i })).toBeChecked()
	})

	it.each([
		['redis', 'Redis Version', '7-alpine', 'redisVersion'],
		['valkey', 'Valkey Version', '8-alpine', 'valkeyVersion']
	] as const)(
		'creates a persistent %s template without SQL credentials',
		async (provider, versionLabel, version, versionKey) => {
			const onSubmit = await renderPanel(provider)

			expect(screen.getByLabelText(versionLabel)).toBeInTheDocument()
			expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
			expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
			expect(screen.queryByLabelText('Database Name')).not.toBeInTheDocument()
			expect(screen.getByRole('switch', { name: /ephemeral storage/i })).not.toBeChecked()

			fireEvent.click(screen.getByRole('button', { name: 'Create Container' }))

			await waitFor(() => {
				expect(onSubmit).toHaveBeenCalledTimes(1)
			})
			const config = onSubmit.mock.calls[0][0]
			expect(config).toMatchObject({
				provider,
				ephemeral: false,
				hostPort: 6379,
				[versionKey]: version
			})
			expect(config).not.toHaveProperty('user')
			expect(config).not.toHaveProperty('password')
			expect(config.volumeName).toBeTruthy()
		}
	)
})
