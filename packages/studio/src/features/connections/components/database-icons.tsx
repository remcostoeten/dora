import {
	BarChart3,
	Boxes,
	Cloud,
	Cylinder,
	Database,
	Feather,
	FileStack,
	HardDrive,
	Network,
	Server,
} from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import type { LucideIcon } from 'lucide-react'

type Props = {
	className?: string
}

export function PostgresIcon({ className }: Props) {
	return <DatabaseGlyph icon={Database} className={className} />
}

export function MySQLIcon({ className }: Props) {
	return <DatabaseGlyph icon={Cylinder} className={className} />
}

export function CockroachIcon({ className }: Props) {
	return <DatabaseGlyph icon={Network} className={className} />
}

export function MariaDBIcon({ className }: Props) {
	return <DatabaseGlyph icon={Server} className={className} />
}

export function SQLiteIcon({ className }: Props) {
	return <DatabaseGlyph icon={HardDrive} className={className} />
}

export function LibSQLIcon({ className }: Props) {
	return <DatabaseGlyph icon={Boxes} className={className} />
}

export function DuckDBIcon({ className }: Props) {
	return <DatabaseGlyph icon={Feather} className={className} />
}

export function CloudflareD1Icon({ className }: Props) {
	return <DatabaseGlyph icon={Cloud} className={className} />
}

type DatabaseType =
	| 'postgres'
	| 'cockroach'
	| 'mysql'
	| 'mariadb'
	| 'sqlite'
	| 'duckdb'
	| 'libsql'
	| 'd1'
	| 'posthog'

type DatabaseIconProps = {
	type: DatabaseType
	className?: string
}

function DatabaseGlyph({
	icon: Icon,
	className,
}: Props & {
	icon: LucideIcon
}) {
	return <Icon className={cn('h-6 w-6', className)} strokeWidth={1.75} />
}

export function DatabaseIcon({ type, className }: DatabaseIconProps) {
	switch (type) {
		case 'postgres':
			return <PostgresIcon className={className} />
		case 'cockroach':
			return <CockroachIcon className={className} />
		case 'mysql':
			return <MySQLIcon className={className} />
		case 'mariadb':
			return <MariaDBIcon className={className} />
		case 'sqlite':
			return <SQLiteIcon className={className} />
		case 'duckdb':
			return <DuckDBIcon className={className} />
		case 'libsql':
			return <LibSQLIcon className={className} />
		case 'd1':
			return <CloudflareD1Icon className={className} />
		case 'posthog':
			return <DatabaseGlyph icon={BarChart3} className={className} />
		default:
			return <DatabaseGlyph icon={FileStack} className={className} />
	}
}

export const DATABASE_META: Record<DatabaseType, { name: string; description: string }> = {
	postgres: {
		name: 'PostgreSQL',
		description: 'Full-featured relational database'
	},
	cockroach: {
		name: 'CockroachDB',
		description: 'Postgres-compatible distributed SQL'
	},
	mysql: {
		name: 'MySQL',
		description: 'Popular open-source RDBMS'
	},
	mariadb: {
		name: 'MariaDB',
		description: 'MySQL-compatible relational database'
	},
	sqlite: {
		name: 'SQLite',
		description: 'Local file-based database'
	},
	duckdb: {
		name: 'DuckDB',
		description: 'Local analytics database'
	},
	libsql: {
		name: 'LibSQL / Turso',
		description: 'Edge-native SQLite fork'
	},
	d1: {
		name: 'Cloudflare D1',
		description: 'Serverless SQLite on the edge'
	},
	posthog: {
		name: 'PostHog',
		description: 'Product analytics, queried with HogQL'
	}
}
