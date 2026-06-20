import type { ReactNode } from 'react'
import { Check, FileSpreadsheet } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import {
	Supabase as SupabaseIcon,
	Turso as TursoIcon,
	Neon as NeonIcon,
	Xata as XataIcon,
	Planetscale as PlanetscaleIcon,
	Vercel as VercelIcon
} from '@studio/components/provider.icons'
import { DatabaseType } from '../../types'
import { DatabaseIcon, DATABASE_META, CloudflareD1Icon } from '../database-icons'

function SelectedProviderIcon({ accent, children }: { accent: string; children: ReactNode }) {
	return (
		<span
			className='inline-grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1'
			style={{ '--db-accent': accent } as React.CSSProperties}
		>
			<span className='text-[var(--db-accent)]'>{children}</span>
			<span className='db-type-icon-glint text-white' aria-hidden>
				{children}
			</span>
		</span>
	)
}

/**
 * A tile in the provider grid. This is wider than `DatabaseType` because some
 * providers (Supabase, Turso) are offered as first-class entries even though
 * they resolve to a plain engine connection — selecting one swaps the form for
 * that provider's connect flow rather than changing `formData.type`.
 */
export type ProviderKey =
	| DatabaseType
	| 'supabase'
	| 'turso'
	| 'neon'
	| 'cloudflare'
	| 'xata'
	| 'planetscale'
	| 'vercel'
	| 'files'

type Props = {
	selectedType: ProviderKey
	onSelect: (type: ProviderKey) => void
	/** Show the Supabase connect tile (new connections only). */
	showSupabase?: boolean
	/** Show the Turso connect tile (new connections only). */
	showTurso?: boolean
	/** Show the Neon connect tile (new connections only). */
	showNeon?: boolean
	/** Show the Cloudflare D1 connect tile (new connections only). */
	showCloudflare?: boolean
	/** Show the Xata connect tile (new connections only). */
	showXata?: boolean
	/** Show the PlanetScale connect tile (new connections only). */
	showPlanetscale?: boolean
	/** Show the Vercel Postgres connect tile (new connections only). */
	showVercel?: boolean
	/** Show the Files tile (opens flat files as a read-only DuckDB connection). */
	showFiles?: boolean
	compact?: boolean
	disabled?: boolean
}

const DATABASE_TYPES: DatabaseType[] = [
	'postgres',
	'cockroach',
	'mysql',
	'mariadb',
	'sqlite',
	'duckdb',
	'libsql'
]

type Theme = { accent: string; wash: string }

const TYPE_THEME: Record<ProviderKey, Theme> = {
	postgres: {
		accent: 'hsl(207 72% 58%)',
		wash: 'color-mix(in srgb, hsl(207 72% 58%) 9%, hsl(var(--card)))'
	},
	cockroach: {
		accent: 'hsl(32 58% 54%)',
		wash: 'color-mix(in srgb, hsl(32 58% 54%) 10%, hsl(var(--card)))'
	},
	mysql: {
		accent: 'hsl(193 55% 52%)',
		wash: 'color-mix(in srgb, hsl(193 55% 52%) 9%, hsl(var(--card)))'
	},
	mariadb: {
		accent: 'hsl(158 42% 50%)',
		wash: 'color-mix(in srgb, hsl(158 42% 50%) 9%, hsl(var(--card)))'
	},
	sqlite: {
		accent: 'hsl(218 28% 58%)',
		wash: 'color-mix(in srgb, hsl(218 28% 58%) 10%, hsl(var(--card)))'
	},
	duckdb: {
		accent: 'hsl(48 72% 52%)',
		wash: 'color-mix(in srgb, hsl(48 72% 52%) 9%, hsl(var(--card)))'
	},
	libsql: {
		accent: 'hsl(169 62% 45%)',
		wash: 'color-mix(in srgb, hsl(169 62% 45%) 9%, hsl(var(--card)))'
	},
	d1: {
		accent: 'hsl(28 90% 55%)',
		wash: 'color-mix(in srgb, hsl(28 90% 55%) 9%, hsl(var(--card)))'
	},
	cloudflare: {
		accent: 'hsl(28 90% 55%)',
		wash: 'color-mix(in srgb, hsl(28 90% 55%) 10%, hsl(var(--card)))'
	},
	supabase: {
		accent: 'hsl(153 60% 45%)',
		wash: 'color-mix(in srgb, hsl(153 60% 45%) 10%, hsl(var(--card)))'
	},
	turso: {
		accent: 'hsl(173 68% 42%)',
		wash: 'color-mix(in srgb, hsl(173 68% 42%) 10%, hsl(var(--card)))'
	},
	neon: {
		accent: 'hsl(149 74% 52%)',
		wash: 'color-mix(in srgb, hsl(149 74% 52%) 10%, hsl(var(--card)))'
	},
	xata: {
		accent: 'hsl(265 84% 64%)',
		wash: 'color-mix(in srgb, hsl(265 84% 64%) 10%, hsl(var(--card)))'
	},
	planetscale: {
		accent: 'hsl(0 0% 88%)',
		wash: 'color-mix(in srgb, hsl(0 0% 88%) 9%, hsl(var(--card)))'
	},
	vercel: {
		accent: 'hsl(0 0% 80%)',
		wash: 'color-mix(in srgb, hsl(0 0% 80%) 10%, hsl(var(--card)))'
	},
	files: {
		accent: 'hsl(38 80% 55%)',
		wash: 'color-mix(in srgb, hsl(38 80% 55%) 10%, hsl(var(--card)))'
	}
}

type Tile = {
	key: ProviderKey
	name: string
	description: string
	icon: React.ReactNode
}

const SUPABASE_TILE: Tile = {
	key: 'supabase',
	name: 'Supabase',
	description: 'Connect your account, pick a project',
	icon: <SupabaseIcon className='h-[18px] w-[18px]' />
}

const TURSO_TILE: Tile = {
	key: 'turso',
	name: 'Turso',
	description: 'Add a token, pick a database',
	icon: <TursoIcon className='h-[18px] w-[18px]' />
}

const NEON_TILE: Tile = {
	key: 'neon',
	name: 'Neon',
	description: 'Add a key, pick a database',
	icon: <NeonIcon className='h-[18px] w-[18px]' />
}

const CLOUDFLARE_TILE: Tile = {
	key: 'cloudflare',
	name: 'Cloudflare D1',
	description: 'Add a token, pick a database',
	icon: <CloudflareD1Icon className='h-[18px] w-[18px]' />
}

const XATA_TILE: Tile = {
	key: 'xata',
	name: 'Xata',
	description: 'Add a key, pick a database',
	icon: <XataIcon className='h-[18px] w-[18px]' />
}

const PLANETSCALE_TILE: Tile = {
	key: 'planetscale',
	name: 'PlanetScale',
	description: 'Add a token, pick a branch',
	icon: <PlanetscaleIcon className='h-[18px] w-[18px]' />
}

const VERCEL_TILE: Tile = {
	key: 'vercel',
	name: 'Vercel Postgres',
	description: 'Add a token, pick a store',
	icon: <VercelIcon className='h-[18px] w-[18px]' />
}

const FILES_TILE: Tile = {
	key: 'files',
	name: 'Files',
	description: 'CSV, Parquet, JSON — read-only',
	icon: <FileSpreadsheet className='h-[18px] w-[18px]' strokeWidth={1.8} />
}

export function DatabaseTypeSelector({
	selectedType,
	onSelect,
	showSupabase,
	showTurso,
	showNeon,
	showCloudflare,
	showXata,
	showPlanetscale,
	showVercel,
	showFiles,
	compact,
	disabled
}: Props) {
	const tiles: Tile[] = DATABASE_TYPES.map(function (type) {
		const meta = DATABASE_META[type]
		return {
			key: type,
			name: meta.name,
			description: meta.description,
			icon: <DatabaseIcon type={type} className='h-[18px] w-[18px]' />
		}
	})

	if (showSupabase) tiles.push(SUPABASE_TILE)
	if (showTurso) tiles.push(TURSO_TILE)
	if (showNeon) tiles.push(NEON_TILE)
	if (showCloudflare) tiles.push(CLOUDFLARE_TILE)
	if (showXata) tiles.push(XATA_TILE)
	if (showPlanetscale) tiles.push(PLANETSCALE_TILE)
	if (showVercel) tiles.push(VERCEL_TILE)
	if (showFiles) tiles.push(FILES_TILE)
	const orderedTiles = compact
		? [...tiles].sort(function (a, b) {
				if (a.key === selectedType) return -1
				if (b.key === selectedType) return 1
				return 0
			})
		: tiles

	return (
		<div
			className={cn(
				'grid grid-cols-2 gap-2 transition-[gap] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] sm:grid-cols-3',
				compact && 'sm:grid-cols-5'
			)}
		>
			{orderedTiles.map(function (tile) {
				const isActive = selectedType === tile.key
				const theme = TYPE_THEME[tile.key]

				return (
					<button
						key={tile.key}
						type='button'
						onClick={function () {
							onSelect(tile.key)
						}}
						disabled={disabled}
						style={
							{
								'--db-accent': theme.accent,
								background: isActive ? theme.wash : undefined,
								borderColor: isActive ? theme.accent : undefined,
								boxShadow: isActive
									? `0 14px 34px -28px ${theme.accent}`
									: undefined
							} as React.CSSProperties
						}
						className={cn(
							'db-type-btn group relative overflow-hidden border p-3 text-left',
							'bg-card/55 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out',
							'hover:border-border/90 hover:bg-card active:scale-[0.985]',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
							compact && 'p-2',
							isActive ? 'ring-1 ring-inset ring-white/10' : 'border-border/55',
							disabled && 'opacity-50 cursor-not-allowed'
						)}
					>
						{isActive && (
							<div
								className='pointer-events-none absolute inset-x-0 top-0 h-px'
								style={{ background: theme.accent }}
							/>
						)}

						<div className='flex items-start gap-3'>
							<div
								className={cn(
									'flex h-9 w-9 shrink-0 items-center justify-center border transition-colors duration-200',
									compact && 'h-8 w-8',
									isActive
										? 'border-white/15 text-[var(--db-accent)]'
										: 'border-border/55 bg-background/55 text-muted-foreground group-hover:text-foreground'
								)}
								style={
									isActive
										? {
												background: `color-mix(in srgb, ${theme.accent} 14%, transparent)`
											}
										: undefined
								}
							>
								{isActive ? (
									<SelectedProviderIcon accent={theme.accent}>
										{tile.icon}
									</SelectedProviderIcon>
								) : (
									tile.icon
								)}
							</div>
							<div className='min-w-0 flex-1 pt-0.5'>
								<span
									className={cn(
										'block truncate text-sm font-medium tracking-tight',
										isActive ? 'text-foreground' : 'text-foreground/85'
									)}
								>
									{tile.name}
								</span>
								<span
									className={cn(
										'mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground/75',
										compact &&
											'hidden group-hover:block group-focus-visible:block'
									)}
								>
									{tile.description}
								</span>
							</div>
							{isActive && !compact && (
								<div
									className='mt-1 flex h-5 w-5 shrink-0 items-center justify-center border bg-background/60'
									style={{
										borderColor: `color-mix(in srgb, ${theme.accent} 38%, transparent)`
									}}
								>
									<Check
										className='h-3 w-3 text-[var(--db-accent)]'
										strokeWidth={2.4}
									/>
								</div>
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
