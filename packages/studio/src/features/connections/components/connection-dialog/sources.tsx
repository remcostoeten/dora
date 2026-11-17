import {
	Neon as NeonIcon,
	Planetscale as PlanetscaleIcon,
	Supabase as SupabaseIcon,
	Turso as TursoIcon,
	Vercel as VercelIcon,
	Xata as XataIcon
} from '@studio/components/provider.icons'
import { DATABASE_META } from '../database-icons'
import type { DatabaseType } from '../../types'
import type { IntegrationKey, SourceId, SourceKind } from './model'
import { ProviderMotionIcon } from './provider-motion/provider-motion-icon'
import type { ProviderIconName } from './provider-motion/registry'

export type GroupId = 'server' | 'local' | 'cloud'

export type ListedSourceId = SourceId | 'files'

export type Source = {
	id: ListedSourceId
	name: string
	blurb: string
	group: GroupId
	kind: SourceKind | 'files'
	accent: string | null
	haystack: string
	icon: React.ReactNode
}

export const GROUPS: readonly { id: GroupId; label: string; hint: string }[] = [
	{ id: 'server', label: 'Database servers', hint: 'Host and credentials, or a URL' },
	{ id: 'local', label: 'Files on this machine', hint: 'Opened in place, never copied' },
	{ id: 'cloud', label: 'Cloud accounts', hint: 'Sign in, then pick a database' }
]

const INTEGRATIONS: readonly IntegrationKey[] = [
	'supabase',
	'turso',
	'neon',
	'cloudflare',
	'xata',
	'planetscale',
	'vercel',
	'posthog'
]

const ICON_CLASS = 'h-[17px] w-[17px]'

function engine(
	id: DatabaseType & ProviderIconName,
	group: GroupId,
	kind: SourceKind,
	accent: string,
	keywords: string
): Source {
	const meta = DATABASE_META[id]
	return {
		id,
		name: meta.name,
		blurb: meta.description,
		group,
		kind,
		accent,
		haystack: `${meta.name} ${meta.description} ${keywords}`.toLowerCase(),
		icon: <ProviderMotionIcon name={id} className={ICON_CLASS} />
	}
}

function provider(
	id: IntegrationKey,
	name: string,
	blurb: string,
	accent: string | null,
	keywords: string,
	icon: React.ReactNode
): Source {
	return {
		id,
		name,
		blurb,
		group: 'cloud',
		kind: 'provider',
		accent,
		haystack: `${name} ${blurb} ${keywords}`.toLowerCase(),
		icon
	}
}

export const SOURCES: readonly Source[] = [
	engine('postgres', 'server', 'server', '207 72% 58%', 'pg psql timescale'),
	engine('mysql', 'server', 'server', '193 55% 52%', 'tidb'),
	engine('cockroach', 'server', 'server', '32 58% 54%', 'crdb'),
	engine('mariadb', 'server', 'server', '158 42% 50%', 'maria'),
	engine('libsql', 'server', 'libsql', '169 62% 45%', 'sqld turso edge'),
	engine('sqlite', 'local', 'file', '218 28% 58%', 'db file local'),
	engine('duckdb', 'local', 'file', '48 72% 52%', 'analytics olap'),
	{
		id: 'files',
		name: 'Files',
		blurb: 'CSV, Parquet, JSON, read-only',
		group: 'local',
		kind: 'files',
		accent: '38 80% 55%',
		haystack: 'files csv, parquet, json, read-only ndjson spreadsheet',
		icon: <ProviderMotionIcon name='files' className={ICON_CLASS} />
	},
	provider(
		'supabase',
		'Supabase',
		'Connect your account, pick a project',
		'153 60% 45%',
		'postgres',
		<SupabaseIcon className={ICON_CLASS} />
	),
	provider(
		'neon',
		'Neon',
		'Add a key, pick a database',
		'149 74% 52%',
		'postgres serverless',
		<NeonIcon className={ICON_CLASS} />
	),
	provider(
		'turso',
		'Turso',
		'Add a token, pick a database',
		'173 68% 42%',
		'libsql sqlite edge',
		<TursoIcon className={ICON_CLASS} />
	),
	provider(
		'planetscale',
		'PlanetScale',
		'Add a token, pick a branch',
		null,
		'mysql vitess',
		<PlanetscaleIcon className={ICON_CLASS} />
	),
	provider(
		'vercel',
		'Vercel Postgres',
		'Add a token, pick a store',
		null,
		'postgres',
		<VercelIcon className={ICON_CLASS} />
	),
	provider(
		'xata',
		'Xata',
		'Add a key, pick a database',
		'265 84% 64%',
		'postgres',
		<XataIcon className={ICON_CLASS} />
	),
	provider(
		'cloudflare',
		'Cloudflare D1',
		'Add a token, pick a database',
		'28 90% 55%',
		'sqlite workers d1',
		<ProviderMotionIcon name='cloudflare' className={ICON_CLASS} />
	),
	provider(
		'posthog',
		'PostHog',
		'Add an API key, query with HogQL',
		'20 90% 55%',
		'analytics hogql events',
		<ProviderMotionIcon name='posthog' className={ICON_CLASS} />
	)
]

const SOURCE_BY_ID = new Map<ListedSourceId, Source>(SOURCES.map((source) => [source.id, source]))

const MANAGED_SOURCE: Source = {
	id: 'd1',
	name: 'Managed connection',
	blurb: 'Created from a provider account',
	group: 'cloud',
	kind: 'managed',
	accent: null,
	haystack: '',
	icon: <ProviderMotionIcon name='d1' className={ICON_CLASS} />
}

/**
 * @name getSource
 * @description Looks up a source by id. Ids that are not offered in the picker
 * (D1, data-file DuckDB sessions opened for editing) resolve to a managed
 * source whose only editable field is the name.
 *
 * @example
 * const source = getSource('postgres')
 */
export function getSource(id: ListedSourceId): Source {
	return SOURCE_BY_ID.get(id) ?? { ...MANAGED_SOURCE, id }
}

export function isIntegration(id: ListedSourceId): id is IntegrationKey {
	return (INTEGRATIONS as readonly string[]).includes(id)
}

/**
 * @name filterSources
 * @description Returns the sources whose name, description or keywords contain
 * every whitespace separated term of the query, in catalog order.
 *
 * @example
 * filterSources('neon pg') // [Neon]
 */
export function filterSources(sources: readonly Source[], query: string): readonly Source[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
	if (terms.length === 0) return sources
	return sources.filter((source) => terms.every((term) => source.haystack.includes(term)))
}
