import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedDatabase } from './container-service';

// Mock the docker-client module
vi.mock('./docker-client', () => ({
    checkDockerAvailability: vi.fn(),
    getContainerLogs: vi.fn(),
    copyToContainer: vi.fn().mockResolvedValue(undefined),
    execCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })
}));

describe('seedDatabase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully copy, exec, and cleanup', async () => {
        const { copyToContainer, execCommand } = await import('./docker-client');

        const result = await seedDatabase('container-123', '/path/to/seed.sql', {
            user: 'testuser',
            database: 'testdb'
        });

        // 1. Copy
        expect(copyToContainer).toHaveBeenCalledWith('container-123', '/path/to/seed.sql', '/tmp/seed.sql');

        // 2. Exec
        expect(execCommand).toHaveBeenCalledWith('container-123', [
            'psql', '-U', 'testuser', '-d', 'testdb', '-f', '/tmp/seed.sql'
        ]);

        // 3. Cleanup
        expect(execCommand).toHaveBeenCalledWith('container-123', ['rm', '/tmp/seed.sql']);

        expect(result).toEqual({ success: true });
    });

    it('should handle exec failure', async () => {
        const { execCommand } = await import('./docker-client');
        vi.mocked(execCommand).mockResolvedValueOnce({ stdout: '', stderr: 'psql error', exitCode: 1 });

        const result = await seedDatabase('container-123', 'file.sql', { user: 'u', database: 'd' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('psql error');
    });
});
