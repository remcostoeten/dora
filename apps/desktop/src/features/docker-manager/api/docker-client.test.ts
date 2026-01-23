
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listContainers, checkDockerAvailability, startContainer, stopContainer, removeContainer } from './docker-client';

// Mock the Tauri shell plugin
const mockExecute = vi.fn();
const mockCreate = vi.fn(() => ({
    execute: mockExecute
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
    Command: {
        create: (cmd: string, args: string[]) => mockCreate(cmd, args)
    }
}));

// Mock window to simulate Tauri environment
Object.defineProperty(window, 'Tauri', {
    value: {},
    writable: true
});

describe('docker-client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
    });

    describe('checkDockerAvailability', () => {
        it('should return available true when docker version command succeeds', async () => {
            mockExecute.mockResolvedValueOnce({
                stdout: '20.10.21\n',
                stderr: '',
                code: 0
            });

            const result = await checkDockerAvailability();

            expect(result).toEqual({ available: true, version: '20.10.21' });
            expect(mockCreate).toHaveBeenCalledWith('docker', ['version', '--format', '{{.Server.Version}}']);
        });

        it('should return available false when docker command fails', async () => {
            mockExecute.mockResolvedValueOnce({
                stdout: '',
                stderr: 'command not found',
                code: 1
            });

            const result = await checkDockerAvailability();

            expect(result).toEqual({ available: false, error: 'command not found' });
        });
    });

    describe('listContainers', () => {
        it('should list and parse containers correctly including Env', async () => {
            // Mock 'ps' command
            mockExecute.mockResolvedValueOnce({
                stdout: '{"ID":"123","Names":"test-container","Image":"postgres:14","State":"running","Status":"Up 2 hours","Ports":"0.0.0.0:5432->5432/tcp","Labels":"","CreatedAt":"2023-01-01"}\n',
                stderr: '',
                code: 0
            });

            // Mock 'inspect' command
            mockExecute.mockResolvedValueOnce({
                stdout: JSON.stringify([{
                    Id: '123',
                    Name: '/test-container',
                    Config: {
                        Image: 'postgres:14',
                        Labels: {},
                        Env: ['POSTGRES_PASSWORD=secret']
                    },
                    State: {
                        Status: 'running',
                        Running: true,
                        Paused: false,
                        Health: { Status: 'healthy' }
                    },
                    Created: '2023-01-01T00:00:00Z',
                    HostConfig: {
                        PortBindings: {
                            '5432/tcp': [{ HostPort: '5432' }]
                        }
                    }
                }]),
                stderr: '',
                code: 0
            });

            const containers = await listContainers();

            expect(containers).toHaveLength(1);
            expect(containers[0]).toMatchObject({
                id: '123',
                name: 'test-container',
                state: 'running',
                health: 'healthy',
                env: ['POSTGRES_PASSWORD=secret']
            });
        });

        it('should handle empty container list', async () => {
            mockExecute.mockResolvedValueOnce({ stdout: '', stderr: '', code: 0 });
            const containers = await listContainers();
            expect(containers).toEqual([]);
        });
    });

    describe('container actions', () => {
        it('should start a container', async () => {
            await startContainer('123');
            expect(mockCreate).toHaveBeenCalledWith('docker', ['start', '123']);
        });

        it('should stop a container', async () => {
            await stopContainer('123');
            expect(mockCreate).toHaveBeenCalledWith('docker', ['stop', '123']);
        });

        it('should remove a container with options', async () => {
            await removeContainer('123', { force: true, removeVolumes: true });
            expect(mockCreate).toHaveBeenCalledWith('docker', ['rm', '-f', '-v', '123']);
        });
    });
});
