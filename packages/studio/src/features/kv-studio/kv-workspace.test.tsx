import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataProvider } from '@studio/core/data-provider'
import type { DockerContainer } from '@studio/features/docker-manager/types'
import { isKeyValueContainer } from '@studio/features/docker-manager/utilities/container-connection'
import { takeRequestedKvConnection } from './kv-launch'
import { KvWorkspace } from './kv-workspace'

function containerFor(overrides: Partial<DockerContainer>): DockerContainer {
	return {
		id: 'c1',
		name: 'cache',
		image: 'postgres',
		imageTag: '17',
		state: 'running',
		health: 'none',
		origin: 'external',
		createdAt: 1_700_000_000,
		ports: [],
		labels: {},
		volumes: [],
		env: [],
		...overrides
	}
}

describe('KvWorkspace outside Tauri', function () {
	it('shows the desktop-only state and no connection controls', async function () {
		render(
			<DataProvider forceMock>
				<KvWorkspace />
			</DataProvider>
		)

		expect(await screen.findByText('Available in the desktop app')).toBeInTheDocument()
		expect(screen.queryByText('Add connection')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('Key-value connection')).not.toBeInTheDocument()
	})
})

describe('KV launch helpers', function () {
	it('recognises Redis and Valkey containers by provider or image', function () {
		expect(isKeyValueContainer(containerFor({ provider: 'redis' }))).toBe(true)
		expect(isKeyValueContainer(containerFor({ provider: 'valkey' }))).toBe(true)
		expect(isKeyValueContainer(containerFor({ image: 'redis/redis-stack' }))).toBe(true)
		expect(isKeyValueContainer(containerFor({ image: 'valkey/valkey' }))).toBe(true)
		expect(isKeyValueContainer(containerFor({ provider: 'postgres' }))).toBe(false)
	})

	it('has no requested connection until a container is opened', function () {
		expect(takeRequestedKvConnection()).toBeNull()
	})
})
