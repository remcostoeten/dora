import type { GeneratorProfile, GeneratorScale } from './types'

export const CONTAINER_PREFIX = 'dora_'

export const DOCKER_SOCKET_PATH = '/var/run/docker.sock'

export const MANAGED_LABEL_KEY = 'com.dora.managed'
export const MANAGED_LABEL_VALUE = 'true'

export const POSTGRES_IMAGE = 'postgres'

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
