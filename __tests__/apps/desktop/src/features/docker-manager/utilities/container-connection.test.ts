import { describe, it, expect } from 'vitest'
import {
	detectConnectionType,
	detectDatabaseProvider,
	getPrimaryDatabasePort,
	getContainerConnectionDetails
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
		expect(detectConnectionType(makeContainer({ image: 'percona', imageTag: '8' }))).toBe('mysql')
	})

	it('detects cockroach images', () => {
		expect(
			detectConnectionType(makeContainer({ image: 'cockroachdb/cockroach', imageTag: 'latest' }))
		).toBe('cockroach')
	})
})

describe('detectDatabaseProvider', () => {
	it('maps mysql images onto the mariadb (mysql-wire) provider', () => {
		expect(detectDatabaseProvider(makeContainer({ image: 'mysql', imageTag: '8' }))).toBe('mariadb')
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
