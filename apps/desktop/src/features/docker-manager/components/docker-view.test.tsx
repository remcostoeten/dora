
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerView } from './docker-view';
import * as useContainersModule from '../api/queries/use-containers';
import * as useCreateContainerModule from '../api/mutations/use-create-container';

// Mock UI components to avoid dependency issues and focus on logic
vi.mock('@/components/ui/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() })
}));

vi.mock('./container-list', () => ({
    ContainerList: ({ containers, isLoading }: any) => (
        <div data-testid="container-list">
            {isLoading ? 'Loading containers...' : `Containers: ${containers?.length || 0}`}
        </div>
    )
}));

vi.mock('./container-details-panel', () => ({
    ContainerDetailsPanel: () => <div data-testid="container-details" />
}));

vi.mock('./create-container-dialog', () => ({
    CreateContainerDialog: ({ open }: any) => (open ? <div data-testid="create-dialog" /> : null)
}));

vi.mock('./sandbox-indicator', () => ({
    SandboxIndicator: () => <div data-testid="sandbox-indicator" />
}));

describe('DockerView', () => {
    const mockCreateContainer = {
        mutate: vi.fn(),
        isPending: false
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        vi.spyOn(useCreateContainerModule, 'useCreateContainer').mockReturnValue(mockCreateContainer as any);
    });

    it('shows loading state when checking docker availability', () => {
        vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
            data: undefined,
            isLoading: true
        } as any);

        vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
            data: [],
            isLoading: false
        } as any);

        // Mock useContainerSearch to return empty array
        vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([]);

        render(<DockerView />);
        expect(screen.getByText('Checking Docker status...')).toBeInTheDocument();
    });

    it('shows error when docker is not available', () => {
        vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
            data: { available: false, error: 'Connection failed' },
            isLoading: false
        } as any);

        vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
            data: [],
            isLoading: false
        } as any);

        vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([]);

        render(<DockerView />);
        expect(screen.getByText('Docker Not Available')).toBeInTheDocument();
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('renders container list when docker is available', () => {
        vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
            data: { available: true },
            isLoading: false
        } as any);

        const mockContainers = [
            { id: '1', name: 'test-1' },
            { id: '2', name: 'test-2' }
        ];

        vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
            data: mockContainers,
            isLoading: false
        } as any);

        // Mock search to return all containers
        vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue(mockContainers as any);

        render(<DockerView />);
        expect(screen.getByText('Containers: 2')).toBeInTheDocument();
        expect(screen.getByText('Docker Containers')).toBeInTheDocument();
    });

    it('opens create dialog when "New Container" is clicked', () => {
        vi.spyOn(useContainersModule, 'useDockerAvailability').mockReturnValue({
            data: { available: true },
            isLoading: false
        } as any);

        vi.spyOn(useContainersModule, 'useContainers').mockReturnValue({
            data: [],
            isLoading: false
        } as any);

        vi.spyOn(useContainersModule, 'useContainerSearch').mockReturnValue([]);

        render(<DockerView />);

        const newButton = screen.getByText('New Container');
        fireEvent.click(newButton);

        expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
    });
});
