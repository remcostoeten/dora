import { describe, it, expect, vi, beforeEach } from 'vitest'


// Mock the docker-client module
vi.mock('../../../../../../../apps/desktop/src/features/docker-manager/api/docker-client', () => ({
	checkDockerAvailability: vi.fn(),
	getContainerLogs: vi.fn(),
	copyToContainer: vi.fn().mockResolvedValue(undefined),
	execCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })
}))

describe('seedDatabase', () => {
	// We need to keep a reference to the dynamically imported module
	let containerService: any;
	let dockerClient: any;

	beforeEach(async () => {
		vi.resetModules() // Important: clear cache so isTauri is re-evaluated
		vi.clearAllMocks()

		// Mock Tauri environment to ensure we test the real implementation
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {},
			writable: true,
			configurable: true
		})

		// Re-import modules after setting up environment
		dockerClient = await import('../../../../../../../apps/desktop/src/features/docker-manager/api/docker-client')
		containerService = await import('../../../../../../../apps/desktop/src/features/docker-manager/api/container-service')
	})

	afterEach(() => {
		// Cleanup environment
		// @ts-ignore
		delete window['__TAURI_INTERNALS__']
	})

	it('should successfully copy, exec, and cleanup', async () => {
		const { copyToContainer, execCommand } = dockerClient

		const result = await containerService.seedDatabase('container-123', '/path/to/seed.sql', {
			user: 'testuser',
			database: 'testdb'
		})

		// 1. Copy
		expect(copyToContainer).toHaveBeenCalledWith(
			'container-123',
			'/path/to/seed.sql',
			'/tmp/seed.sql'
		)

		// 2. Exec
		expect(execCommand).toHaveBeenCalledWith('container-123', [
			'psql',
			'-U',
			'testuser',
			'-d',
			'testdb',
			'-f',
			'/tmp/seed.sql'
		])

		// 3. Cleanup
		expect(execCommand).toHaveBeenCalledWith('container-123', ['rm', '/tmp/seed.sql'])

		expect(result).toEqual({ success: true })
	})

	it('should handle exec failure', async () => {
		const { execCommand } = dockerClient

		vi.mocked(execCommand).mockResolvedValueOnce({
			stdout: '',
			stderr: 'psql error',
			exitCode: 1
		})

		const result = await containerService.seedDatabase('container-123', 'file.sql', { user: 'u', database: 'd' })

		expect(result.success).toBe(false)
		expect(result.error).toContain('psql error')
	})
})
