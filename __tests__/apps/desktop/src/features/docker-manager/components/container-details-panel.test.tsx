import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import { ContainerDetailsPanel } from '@/features/docker-manager/components/container-details-panel'
import type { DockerContainer } from '@/features/docker-manager/types'
import { TooltipProvider } from '@/shared/ui/tooltip'

function makeContainer(overrides: Partial<DockerContainer>): DockerContainer {
	return {
		id: 'test-id',
		name: 'test-container',
		image: 'postgres',
		imageTag: '17',
		state: 'running',
		health: 'healthy',
		origin: 'managed',
		createdAt: 0,
		ports: [],
		labels: {},
		volumes: [],
		env: [],
		...overrides
	}
}

function renderPanel(container: DockerContainer) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	})

	return render(
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ContainerDetailsPanel container={container} />
			</TooltipProvider>
		</QueryClientProvider>
	)
}

describe('ContainerDetailsPanel', () => {
	it('offers the data viewer and seeding for a SQL container', () => {
		renderPanel(
			makeContainer({ ports: [{ hostPort: 5433, containerPort: 5432, protocol: 'tcp' }] })
		)

		expect(screen.getByRole('button', { name: /open in data viewer/i })).toBeInTheDocument()
		expect(screen.queryByText(/open in kv studio/i)).not.toBeInTheDocument()
		expect(screen.getByText('Seed Data')).toBeInTheDocument()
		expect(screen.getByText('Database')).toBeInTheDocument()
	})

	it.each([
		['redis', '7-alpine'],
		['valkey/valkey', '8-alpine']
	])('offers KV Studio and hides SQL affordances for %s', (image, imageTag) => {
		renderPanel(
			makeContainer({
				image,
				imageTag,
				ports: [{ hostPort: 6390, containerPort: 6379, protocol: 'tcp' }]
			})
		)

		expect(screen.getByRole('button', { name: /open in kv studio/i })).toBeInTheDocument()
		expect(screen.queryByText(/open in data viewer/i)).not.toBeInTheDocument()
		expect(screen.queryByText('Seed Data')).not.toBeInTheDocument()
		expect(screen.queryByText('Password')).not.toBeInTheDocument()
		expect(screen.queryByText('Database')).not.toBeInTheDocument()
		expect(screen.getByText('redis://127.0.0.1:6390/0')).toBeInTheDocument()
	})
})
