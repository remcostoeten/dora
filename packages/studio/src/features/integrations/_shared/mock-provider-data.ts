import type { Connection } from '../../connections/types'

export type MockProviderProject = {
	id: string
	name: string
	region: string
	detail?: string
}

export type MockProviderConfig = {
	label: string
	accent: 'emerald' | 'sky' | 'violet' | 'amber' | 'pink' | 'orange'
	blurb: string
	connectLabel: string
	itemNoun: string
	projects: MockProviderProject[]
	buildConnection: (project: MockProviderProject) => Omit<Connection, 'id' | 'createdAt'>
}

function buildPostgresConnection(
	project: MockProviderProject
): Omit<Connection, 'id' | 'createdAt'> {
	return {
		name: project.name,
		type: 'postgres',
		url: `postgresql://demo:demo@${project.id}.${project.region}.demo:5432/postgres`,
		status: 'idle'
	}
}

export const SUPABASE_MOCK: MockProviderConfig = {
	label: 'Supabase',
	accent: 'emerald',
	blurb: 'Pick a project to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Supabase',
	itemNoun: 'project',
	projects: [
		{ id: 'qz8x4m2', name: 'storefront-prod', region: 'us-east-1', detail: 'Healthy' },
		{ id: 'rt3p9kd', name: 'storefront-staging', region: 'eu-west-2', detail: 'Healthy' },
		{ id: 'lm6w1ab', name: 'internal-tools', region: 'ap-southeast-1', detail: 'Paused' }
	],
	buildConnection: (project) => ({
		...buildPostgresConnection(project),
		poolerMode: true
	})
}

export const NEON_MOCK: MockProviderConfig = {
	label: 'Neon',
	accent: 'sky',
	blurb: 'Pick a branch to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Neon',
	itemNoun: 'branch',
	projects: [
		{ id: 'wandering-sky-12', name: 'main', region: 'aws-us-east-2', detail: 'Primary' },
		{
			id: 'wandering-sky-12',
			name: 'preview/checkout',
			region: 'aws-us-east-2',
			detail: 'Branch'
		},
		{ id: 'damp-frost-88', name: 'analytics', region: 'aws-eu-central-1', detail: 'Primary' }
	],
	buildConnection: buildPostgresConnection
}

export const VERCEL_MOCK: MockProviderConfig = {
	label: 'Vercel',
	accent: 'violet',
	blurb: 'Pick a Postgres store to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Vercel',
	itemNoun: 'store',
	projects: [
		{ id: 'store_a1b2c3', name: 'marketing-db', region: 'iad1', detail: 'Postgres' },
		{ id: 'store_d4e5f6', name: 'commerce-db', region: 'sfo1', detail: 'Postgres' }
	],
	buildConnection: buildPostgresConnection
}

export const XATA_MOCK: MockProviderConfig = {
	label: 'Xata',
	accent: 'pink',
	blurb: 'Pick a database to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Xata',
	itemNoun: 'database',
	projects: [
		{ id: 'workspace-7y2z', name: 'products', region: 'us-east-1', detail: 'Postgres' },
		{ id: 'workspace-7y2z', name: 'orders', region: 'us-east-1', detail: 'Postgres' }
	],
	buildConnection: buildPostgresConnection
}

export const TURSO_MOCK: MockProviderConfig = {
	label: 'Turso',
	accent: 'emerald',
	blurb: 'Pick a database to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Turso',
	itemNoun: 'database',
	projects: [
		{ id: 'edge-cache', name: 'edge-cache', region: 'fra', detail: 'libSQL' },
		{ id: 'sessions', name: 'sessions', region: 'iad', detail: 'libSQL' },
		{ id: 'feature-flags', name: 'feature-flags', region: 'syd', detail: 'libSQL' }
	],
	buildConnection: (project) => ({
		name: project.name,
		type: 'libsql',
		url: `libsql://${project.id}-demo.turso.io`,
		authToken: 'demo-token',
		status: 'idle'
	})
}

export const PLANETSCALE_MOCK: MockProviderConfig = {
	label: 'PlanetScale',
	accent: 'orange',
	blurb: 'Pick a branch to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with PlanetScale',
	itemNoun: 'branch',
	projects: [
		{ id: 'commerce', name: 'commerce/main', region: 'us-east', detail: 'Production' },
		{ id: 'commerce', name: 'commerce/dev', region: 'us-east', detail: 'Development' }
	],
	buildConnection: (project) => ({
		name: project.name,
		type: 'mysql',
		url: `mysql://demo:demo@aws.connect.psdb.cloud:3306/${project.id}`,
		ssl: true,
		status: 'idle'
	})
}

export const CLOUDFLARE_MOCK: MockProviderConfig = {
	label: 'Cloudflare D1',
	accent: 'amber',
	blurb: 'Pick a D1 database to preview it with demo data — no account needed in the web preview.',
	connectLabel: 'Connect with Cloudflare',
	itemNoun: 'database',
	projects: [
		{ id: 'd1-1a2b3c', name: 'app-db', region: 'WNAM', detail: 'D1' },
		{ id: 'd1-4d5e6f', name: 'edge-logs', region: 'WEUR', detail: 'D1' }
	],
	buildConnection: (project) => ({
		name: project.name,
		type: 'd1',
		url: `d1://${project.id}`,
		status: 'idle'
	})
}
