import { describe, expect, it } from 'vitest'
import type { RedisContainerConfig, ValkeyContainerConfig } from '../types'
import {
	buildCreateContainerArgs,
	getDatabaseImageConfig,
	getDatabaseVolumePath
} from './container-service'

function redisConfig(overrides: Partial<RedisContainerConfig> = {}): RedisContainerConfig {
	return {
		provider: 'redis',
		name: 'dora_redis',
		hostPort: 6379,
		ephemeral: false,
		volumeName: 'dora_redis_data',
		redisVersion: '7-alpine',
		...overrides
	}
}

function valkeyConfig(overrides: Partial<ValkeyContainerConfig> = {}): ValkeyContainerConfig {
	return {
		provider: 'valkey',
		name: 'dora_valkey',
		hostPort: 6380,
		ephemeral: false,
		volumeName: 'dora_valkey_data',
		valkeyVersion: '8-alpine',
		...overrides
	}
}

describe('key-value container templates', function () {
	it('builds a persistent Redis container with AOF and a health check', function () {
		const config = redisConfig()
		const imageConfig = getDatabaseImageConfig(config)
		const args = buildCreateContainerArgs(config, imageConfig.imageTag, imageConfig)

		expect(imageConfig).toMatchObject({
			image: 'redis',
			imageTag: '7-alpine',
			displayName: 'Redis',
			command: ['redis-server', '--appendonly', 'yes']
		})
		expect(args).toContain('127.0.0.1:6379:6379')
		expect(args).toContain('redis-cli ping')
		expect(args).toContain('dora_redis_data:/data')
		expect(args.slice(-4)).toEqual(['redis:7-alpine', 'redis-server', '--appendonly', 'yes'])
	})

	it('builds a persistent Valkey container with its native CLI health check', function () {
		const config = valkeyConfig()
		const imageConfig = getDatabaseImageConfig(config)
		const args = buildCreateContainerArgs(config, imageConfig.imageTag, imageConfig)

		expect(imageConfig).toMatchObject({
			image: 'valkey/valkey',
			imageTag: '8-alpine',
			displayName: 'Valkey',
			command: ['valkey-server', '--appendonly', 'yes']
		})
		expect(args).toContain('127.0.0.1:6380:6379')
		expect(args).toContain('valkey-cli ping')
		expect(args).toContain('dora_valkey_data:/data')
		expect(args.slice(-4)).toEqual([
			'valkey/valkey:8-alpine',
			'valkey-server',
			'--appendonly',
			'yes'
		])
	})

	it('does not mount a data volume for an explicitly ephemeral template', function () {
		const config = redisConfig({ ephemeral: true })
		const imageConfig = getDatabaseImageConfig(config)
		const args = buildCreateContainerArgs(config, imageConfig.imageTag, imageConfig)

		expect(args).not.toContain('dora_redis_data:/data')
		expect(getDatabaseVolumePath('redis')).toBe('/data')
		expect(getDatabaseVolumePath('valkey')).toBe('/data')
	})
})
