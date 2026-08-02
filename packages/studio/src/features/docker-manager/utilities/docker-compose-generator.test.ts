import { describe, expect, it } from 'vitest'
import type { DockerContainer } from '../types'
import { generateDockerCompose } from './docker-compose-generator'

function keyValueContainer(image: string): DockerContainer {
	return {
		id: 'container-id',
		name: image.includes('valkey') ? 'dora_valkey' : 'dora_redis',
		image,
		imageTag: image.includes('valkey') ? '8-alpine' : '7-alpine',
		state: 'running',
		health: 'healthy',
		origin: 'managed',
		createdAt: 0,
		ports: [{ hostPort: 6379, containerPort: 6379, protocol: 'tcp' }],
		labels: {},
		volumes: [{ name: 'data', mountPath: '/data', isEphemeral: false }],
		env: []
	}
}

describe('key-value Docker Compose export', function () {
	it.each([
		['redis', 'redis-server'],
		['valkey/valkey', 'valkey-server']
	])('keeps %s data and AOF persistence', function (image, serverCommand) {
		const compose = generateDockerCompose(keyValueContainer(image))

		expect(compose).toContain('- "6379:6379"')
		expect(compose).toContain(`- ${serverCommand}`)
		expect(compose).toContain('- --appendonly')
		expect(compose).toContain('- "yes"')
		expect(compose).toContain('- dora_')
		expect(compose).toContain('-data:/data')
	})
})
