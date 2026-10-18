import { describe, it, expect } from 'vitest'
import {
	detectConnectionType,
	detectDatabaseProvider,
	detectKeyValueProvider,
	getPrimaryDatabasePort,
	getContainerConnectionDetails,
	getKeyValueConnectionUrl,
	isKeyValueContainer
} from '@/features/docker-manager/utilities/container-connection'
import type { DockerContainer, PortMapping } from '@/features/docker-manager/types'

function makeContainer(overrides: Partial<DockerContainer>): DockerContainer {
	return {
		id: 'test-id',
		name: 'test-container',
		image: 'postgres',
		imageTag: '16',
		state: 'running',
		health: 'healthy',
		origin: 'external',
		createdAt: 0,
		ports: [],
		labels: {},
		volumes: [],
		env: [],
		...overrides
	}
}

function port(containerPort: number, hostPort: number): PortMapping {
	return { containerPort, hostPort, protocol: 'tcp' }
}

describe('detectConnectionType', () => {
	it('detects postgres images', () => {
		expect(detectConnectionType(makeContainer({ image: 'postgres', imageTag: '16' }))).toBe(
			'postgres'
		)
	})

	it('detects mariadb images', () => {
		expect(detectConnectionType(makeContainer({ image: 'mariadb', imageTag: '10.7' }))).toBe(
			'mariadb'
		)
	})

	it('detects plain mysql images as mysql (not postgres)', () => {
		expect(detectConnectionType(makeContainer({ image: 'mysql', imageTag: '8' }))).toBe('mysql')
		expect(detectConnectionType(makeContainer({ image: 'percona', imageTag: '8' }))).toBe(
			'mysql'
		)
	})

	it('detects cockroach images', () => {
		expect(
			detectConnectionType(
				makeContainer({ image: 'cockroachdb/cockroach', imageTag: 'latest' })
			)
		).toBe('cockroach')
	})
})

describe('detectDatabaseProvider', () => {
	it('maps mysql images onto the mysql provider', () => {
		expect(detectDatabaseProvider(makeContainer({ image: 'mysql', imageTag: '8' }))).toBe(
			'mysql'
		)
	})

	it('maps mariadb images onto the mariadb provider', () => {
		expect(detectDatabaseProvider(makeContainer({ image: 'mariadb', imageTag: '10.7' }))).toBe(
			'mariadb'
		)
	})
})

describe('getPrimaryDatabasePort', () => {
	it('uses the mapped host port for mysql/mariadb (3306 container port)', () => {
		const container = makeContainer({
			image: 'mariadb',
			imageTag: '10.7',
			ports: [port(3306, 53306)]
		})
		expect(getPrimaryDatabasePort(container)).toBe(53306)
	})

	it('uses the mapped host port for postgres (5432 container port)', () => {
		const container = makeContainer({
			image: 'postgres',
			imageTag: '16',
			ports: [port(5432, 15432)]
		})
		expect(getPrimaryDatabasePort(container)).toBe(15432)
	})
})

describe('getContainerConnectionDetails', () => {
	// Regression: a mariadb image that is configured with MYSQL_* env vars
	// (the official mariadb image accepts both) must connect as mariadb with
	// the real credentials — not fall back to Postgres / root.
	it('reads MYSQL_* env vars from a mariadb image', () => {
		const container = makeContainer({
			image: 'mariadb',
			imageTag: '10.7',
			ports: [port(3306, 53306)],
			env: [
				'MYSQL_DATABASE=powerwalk_db',
				'MYSQL_USER=powerwalk_usr',
				'MYSQL_PASSWORD=powerwalk_pass',
				'MYSQL_ROOT_PASSWORD=secret'
			]
		})

		const details = getContainerConnectionDetails(container)

		expect(details.type).toBe('mariadb')
		expect(details.host).toBe('localhost')
		expect(details.port).toBe(53306)
		expect(details.user).toBe('powerwalk_usr')
		expect(details.password).toBe('powerwalk_pass')
		expect(details.database).toBe('powerwalk_db')
		expect(details.connectionUrl).toBe(
			'mysql://powerwalk_usr:powerwalk_pass@localhost:53306/powerwalk_db'
		)
	})

	it('reads MARIADB_* env vars from a mariadb image', () => {
		const container = makeContainer({
			image: 'mariadb',
			imageTag: '11',
			ports: [port(3306, 3306)],
			env: ['MARIADB_DATABASE=app', 'MARIADB_USER=appuser', 'MARIADB_PASSWORD=apppass']
		})

		const details = getContainerConnectionDetails(container)

		expect(details.type).toBe('mariadb')
		expect(details.user).toBe('appuser')
		expect(details.password).toBe('apppass')
		expect(details.database).toBe('app')
	})

	it('keeps detecting postgres containers correctly', () => {
		const container = makeContainer({
			image: 'postgres',
			imageTag: '16',
			ports: [port(5432, 5432)],
			env: ['POSTGRES_USER=admin', 'POSTGRES_PASSWORD=pw', 'POSTGRES_DB=mydb']
		})

		const details = getContainerConnectionDetails(container)

		expect(details.type).toBe('postgres')
		expect(details.user).toBe('admin')
		expect(details.password).toBe('pw')
		expect(details.database).toBe('mydb')
		expect(details.connectionUrl).toBe('postgresql://admin:pw@localhost:5432/mydb')
	})
})

describe('key-value container detection', () => {
	it.each([
		['redis', 'redis'],
		['library/redis', 'redis'],
		['bitnami/redis', 'redis'],
		['redis/redis-stack', 'redis'],
		['valkey/valkey', 'valkey'],
		['ghcr.io/valkey-io/valkey', 'valkey'],
		['localhost:5000/Valkey', 'valkey']
	])('detects %s as %s from the image repository', (image, expected) => {
		const container = makeContainer({ image, imageTag: '8-alpine' })

		expect(detectKeyValueProvider(container)).toBe(expected)
		expect(detectDatabaseProvider(container)).toBe(expected)
		expect(isKeyValueContainer(container)).toBe(true)
	})

	it('trusts the provider field over the image', () => {
		const container = makeContainer({ image: 'custom/cache', provider: 'valkey' })

		expect(detectKeyValueProvider(container)).toBe('valkey')
	})

	it.each(['postgres', 'mysql', 'mariadb', 'cockroachdb/cockroach', 'redis/redisinsight'])(
		'does not treat %s as a key-value server',
		(image) => {
			const container = makeContainer({ image })

			expect(detectKeyValueProvider(container)).toBeNull()
			expect(isKeyValueContainer(container)).toBe(false)
		}
	)

	it('uses the host port mapped to 6379 for the primary port and the URL', () => {
		const container = makeContainer({ image: 'redis', ports: [port(6379, 6390)] })

		expect(getPrimaryDatabasePort(container)).toBe(6390)
		expect(getKeyValueConnectionUrl(container)).toBe('redis://127.0.0.1:6390/0')
	})

	it('falls back to 6379 when no port mapping is listed', () => {
		const container = makeContainer({ image: 'valkey/valkey', ports: [] })

		expect(getKeyValueConnectionUrl(container)).toBe('redis://127.0.0.1:6379/0')
	})
})
