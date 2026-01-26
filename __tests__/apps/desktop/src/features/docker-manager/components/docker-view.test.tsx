import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DockerView } from '../../../../../../../apps/desktop/src/features/docker-manager/components/docker-view'
import * as useContainersModule from '../../../../../../../apps/desktop/src/features/docker-manager/api/queries/use-containers'
import * as useCreateContainerModule from '../../../../../../../apps/desktop/src/features/docker-manager/api/mutations/use-create-container'
import { TooltipProvider } from '@/shared/ui/tooltip'

// Mock UI components to avoid dependency issues and focus on logic
vi.mock('@/components/ui/use-toast', () => ({
	useToast: () => ({ toast: vi.fn() })
}))

vi.mock('../../../../../../../apps/desktop/src/features/docker-manager/components/container-list', () => ({
	ContainerList: ({ containers, isLoading }: any) => (
		<div data-testid='container-list'>
			{isLoading ? 'Loading containers...' : `Containers: ${containers?.length || 0}`}
		</div>
	)
}))

vi.mock('../../../../../../../apps/desktop/src/features/docker-manager/components/container-details-panel', () => ({
	ContainerDetailsPanel: () => <div data-testid='container-details' />
}))

vi.mock('../../../../../../../apps/desktop/src/features/docker-manager/components/create-container-dialog', () => ({
	CreateContainerDialog: ({ open }: any) => (open ? <div data-testid='create-dialog' /> : null)
}))

vi.mock('../../../../../../../apps/desktop/src/features/docker-manager/components/sandbox-indicator', () => ({
	SandboxIndicator: () => <div data-testid='sandbox-indicator' />
}))

describe('DockerView', () => {
	const mockCreateContainer = {
		mutate: vi.fn(),
		isPending: false
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Default mocks
		vi.spyOn(useCreateContainerModule, 'useCreateContainer').mockReturnValue(
			mockCreateContainer as any
		)
	})

	const renderWithProviders = (component: any) => {
		return render(
			<TooltipProvider>
				{component}
			</TooltipProvider>
		)
	}

	it('shows loading state when checking docker availability', () => {
		vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
			data: undefined,
			isLoading: true
		} as any)

		vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
			data: [],
			isLoading: false
		} as any)

		// Mock useContainerSearch to return empty array
		vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([])

		renderWithProviders(<DockerView />)
		expect(screen.getByText('Checking Docker status...')).toBeInTheDocument()
	})

	it('shows error when docker is not available', () => {
		vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
			data: { available: false, error: 'Connection failed' },
			isLoading: false
		} as any)

		vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
			data: [],
			isLoading: false
		} as any)

		vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([])

		renderWithProviders(<DockerView />)
		expect(screen.getByText('Docker Not Available')).toBeInTheDocument()
		expect(screen.getByText('Connection failed')).toBeInTheDocument()
	})

	it('renders container list when docker is available', () => {
		vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
			data: { available: true },
			isLoading: false
		} as any)

		const mockContainers = [
			{ id: '1', names: ['test-1'], state: 'running', created: Date.now() },
			{ id: '2', names: ['test-2'], state: 'exited', created: Date.now() }
		]

		vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
			data: mockContainers,
			isLoading: false
		} as any)

		// Mock search to return all containers
		vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue(mockContainers as any)

		renderWithProviders(<DockerView />)
		expect(screen.getByText('Containers: 2')).toBeInTheDocument()
		expect(screen.getByText('Docker Containers')).toBeInTheDocument()
	})

	it('opens create dialog when "New Container" is clicked', () => {
		vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
			data: { available: true },
			isLoading: false
		} as any)

		vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
			data: [],
			isLoading: false
		} as any)

		vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([])

		renderWithProviders(<DockerView />)

		const newButton = screen.getByText('New Container')
		fireEvent.click(newButton)

		expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
	})
})
