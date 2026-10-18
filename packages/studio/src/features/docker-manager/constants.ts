import type {
	GeneratorProfile,
	GeneratorScale,
	DatabaseProvider,
	ContainerSortConfig,
	ContainerFilterConfig
} from './types'

export const CONTAINER_PREFIX = 'dora_'

export const DOCKER_SOCKET_PATH = '/var/run/docker.sock'

export const MANAGED_LABEL_KEY = 'com.dora.managed'
export const MANAGED_LABEL_VALUE = 'true'

export const PROJECT_LABEL_KEY = 'com.dora.project'
export const COMPOSE_PATH_LABEL_KEY = 'com.dora.compose-file'

export const DEFAULT_SORT: ContainerSortConfig = {
	field: 'createdAt',
	direction: 'desc'
}

export const DEFAULT_FILTER: ContainerFilterConfig = {
	states: [],
	healths: [],
	origins: []
}

export const POSTGRES_IMAGE = 'postgres'
export const MARIADB_IMAGE = 'mariadb'
export const MYSQL_IMAGE = 'mysql'
export const COCKROACH_IMAGE = 'cockroachdb/cockroach'
export const REDIS_IMAGE = 'redis'
export const VALKEY_IMAGE = 'valkey/valkey'

export const POSTGRES_VERSIONS = [
	{ value: '17', label: 'PostgreSQL 17 (Latest)' },
	{ value: '16', label: 'PostgreSQL 16' },
	{ value: '15', label: 'PostgreSQL 15' },
	{ value: '14', label: 'PostgreSQL 14' },
	{ value: '13', label: 'PostgreSQL 13' }
] as const

export const DEFAULT_POSTGRES_VERSION = '16'

export const DEFAULT_POSTGRES_USER = 'postgres'
export const DEFAULT_POSTGRES_PASSWORD = 'postgres'
export const DEFAULT_POSTGRES_DATABASE = 'postgres'

export const POSTGRES_CONTAINER_PORT = 5432
export const MARIADB_CONTAINER_PORT = 3306
export const MYSQL_CONTAINER_PORT = 3306
export const COCKROACH_CONTAINER_PORT = 26257
export const REDIS_CONTAINER_PORT = 6379
export const VALKEY_CONTAINER_PORT = 6379

export const DATABASE_PROVIDERS: Array<{
	value: DatabaseProvider
	label: string
	description: string
}> = [
	{
		value: 'postgres',
		label: 'PostgreSQL',
		description: 'General-purpose relational database'
	},
	{
		value: 'mariadb',
		label: 'MariaDB',
		description: 'MySQL-compatible database'
	},
	{
		value: 'mysql',
		label: 'MySQL',
		description: "The world's most popular open-source database"
	},
	{
		value: 'cockroach',
		label: 'CockroachDB',
		description: 'Distributed SQL with PostgreSQL wire compatibility'
	},
	{
		value: 'redis',
		label: 'Redis',
		description: 'In-memory data store and cache'
	},
	{
		value: 'valkey',
		label: 'Valkey',
		description: 'Open-source Redis-compatible data store'
	}
]

export const MARIADB_VERSIONS = [
	{ value: '11.4', label: 'MariaDB 11.4 (Latest)' },
	{ value: '11.3', label: 'MariaDB 11.3' },
	{ value: '11.2', label: 'MariaDB 11.2' }
] as const

export const DEFAULT_MARIADB_VERSION = '11.4'
export const DEFAULT_MARIADB_USER = 'root'
export const DEFAULT_MARIADB_PASSWORD = 'rootpass'
export const DEFAULT_MARIADB_DATABASE = 'dora'

export const MYSQL_VERSIONS = [
	{ value: '8.4', label: 'MySQL 8.4 (LTS)' },
	{ value: '8.0', label: 'MySQL 8.0' },
	{ value: '5.7', label: 'MySQL 5.7' }
] as const

export const DEFAULT_MYSQL_VERSION = '8.4'
export const DEFAULT_MYSQL_USER = 'root'
export const DEFAULT_MYSQL_PASSWORD = 'rootpass'
export const DEFAULT_MYSQL_DATABASE = 'dora'

export const COCKROACH_VERSIONS = [
	{ value: '25.1.1', label: 'CockroachDB 25.1.1 (Latest)' },
	{ value: '24.3.5', label: 'CockroachDB 24.3.5' }
] as const

export const DEFAULT_COCKROACH_VERSION = '25.1.1'
export const DEFAULT_COCKROACH_USER = 'root'
export const DEFAULT_COCKROACH_DATABASE = 'defaultdb'

export const REDIS_VERSIONS = [
	{ value: '7-alpine', label: 'Redis 7 (Alpine)' },
	{ value: '7.4-alpine', label: 'Redis 7.4 (Alpine)' },
	{ value: '7.2-alpine', label: 'Redis 7.2 (Alpine)' }
] as const

export const DEFAULT_REDIS_VERSION = '7-alpine'

export const VALKEY_VERSIONS = [
	{ value: '8-alpine', label: 'Valkey 8 (Alpine)' },
	{ value: '8.1-alpine', label: 'Valkey 8.1 (Alpine)' },
	{ value: '8.0-alpine', label: 'Valkey 8.0 (Alpine)' }
] as const

export const DEFAULT_VALKEY_VERSION = '8-alpine'

export const DEFAULT_HOST_PORT_START = 5433
export const DEFAULT_HOST_PORT_END = 5500

export const CONTAINER_POLL_INTERVAL_MS = 2000

export const LOG_TAIL_OPTIONS = [100, 500, 1000, 5000] as const
export const DEFAULT_LOG_TAIL = 100

export const LOCAL_HOST_PATTERNS = ['localhost', '127.0.0.1', 'host.docker.internal'] as const

export const LOCAL_IP_REGEX_PATTERNS = [
	/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
	/^192\.168\.\d{1,3}\.\d{1,3}$/,
	/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
]

export const GENERATOR_PROFILES: GeneratorProfile[] = [
	{
		id: 'ecommerce',
		name: 'E-Commerce',
		description: 'Users, products, orders, and reviews',
		tables: ['users', 'products', 'orders', 'order_items', 'reviews']
	},
	{
		id: 'blog',
		name: 'Blog Platform',
		description: 'Authors, posts, comments, and tags',
		tables: ['authors', 'posts', 'comments', 'tags', 'post_tags']
	},
	{
		id: 'analytics',
		name: 'Analytics Events',
		description: 'Users, sessions, and events',
		tables: ['users', 'sessions', 'events', 'page_views']
	}
]

export const GENERATOR_SCALES: GeneratorScale[] = [
	{ id: 'small', label: 'Small (1K rows)', rowCount: 1000, estimatedTimeSeconds: 5 },
	{ id: 'medium', label: 'Medium (10K rows)', rowCount: 10000, estimatedTimeSeconds: 15 },
	{ id: 'large', label: 'Large (100K rows)', rowCount: 100000, estimatedTimeSeconds: 45 },
	{ id: 'xl', label: 'XL (1M rows)', rowCount: 1000000, estimatedTimeSeconds: 300 }
]

export const HEALTHCHECK_TIMEOUT_MS = 30000
export const HEALTHCHECK_INTERVAL_MS = 1000

export const ENV_VAR_TEMPLATE = `DATABASE_URL={databaseUrl}
PGHOST={host}
PGPORT={port}
PGUSER={user}
PGPASSWORD={password}
PGDATABASE={database}`
