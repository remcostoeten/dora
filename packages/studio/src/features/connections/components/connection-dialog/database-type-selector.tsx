import { Check } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import { Supabase as SupabaseIcon } from '@studio/components/provider.icons'
import { DatabaseType } from '../../types'
import { DatabaseIcon, DATABASE_META } from '../database-icons'

/**
 * A tile in the provider grid. This is wider than `DatabaseType` because
 * Supabase is offered as a first-class entry even though it resolves to a
 * plain Postgres connection — selecting it swaps the form for the OAuth flow
 * rather than changing `formData.type`.
 */
export type ProviderKey = DatabaseType | 'supabase'

type Props = {
	selectedType: ProviderKey
	onSelect: (type: ProviderKey) => void
	/** Show the Supabase OAuth tile (new connections only). */
	showSupabase?: boolean
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
		wash: 'color-mix(in srgb, hsl(207 72% 58%) 9%, hsl(var(--card)))',
	},
	cockroach: {
		accent: 'hsl(32 58% 54%)',
		wash: 'color-mix(in srgb, hsl(32 58% 54%) 10%, hsl(var(--card)))',
	},
	mysql: {
		accent: 'hsl(193 55% 52%)',
		wash: 'color-mix(in srgb, hsl(193 55% 52%) 9%, hsl(var(--card)))',
	},
	mariadb: {
		accent: 'hsl(158 42% 50%)',
		wash: 'color-mix(in srgb, hsl(158 42% 50%) 9%, hsl(var(--card)))',
	},
	sqlite: {
		accent: 'hsl(218 28% 58%)',
		wash: 'color-mix(in srgb, hsl(218 28% 58%) 10%, hsl(var(--card)))',
	},
	duckdb: {
		accent: 'hsl(48 72% 52%)',
		wash: 'color-mix(in srgb, hsl(48 72% 52%) 9%, hsl(var(--card)))',
	},
	libsql: {
		accent: 'hsl(169 62% 45%)',
		wash: 'color-mix(in srgb, hsl(169 62% 45%) 9%, hsl(var(--card)))',
	},
	supabase: {
		accent: 'hsl(153 60% 45%)',
		wash: 'color-mix(in srgb, hsl(153 60% 45%) 10%, hsl(var(--card)))',
	},
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
	icon: <SupabaseIcon className='h-[18px] w-[18px]' />,
}

export function DatabaseTypeSelector({ selectedType, onSelect, showSupabase, disabled }: Props) {
	const tiles: Tile[] = DATABASE_TYPES.map(function (type) {
		const meta = DATABASE_META[type]
		return {
			key: type,
			name: meta.name,
			description: meta.description,
			icon: <DatabaseIcon type={type} className='h-[18px] w-[18px]' />,
		}
	})

	if (showSupabase) tiles.push(SUPABASE_TILE)

	return (
		<div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
			{tiles.map(function (tile) {
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
								boxShadow: isActive ? `0 14px 34px -28px ${theme.accent}` : undefined,
							} as React.CSSProperties
						}
						className={cn(
							'db-type-btn group relative overflow-hidden border p-3 text-left',
							'bg-card/55 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out',
							'hover:border-border/90 hover:bg-card active:scale-[0.985]',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
							isActive
								? 'ring-1 ring-inset ring-white/10'
								: 'border-border/55',
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
									isActive
										? 'border-white/15 text-[var(--db-accent)]'
										: 'border-border/55 bg-background/55 text-muted-foreground group-hover:text-foreground'
								)}
								style={
									isActive
										? { background: `color-mix(in srgb, ${theme.accent} 14%, transparent)` }
										: undefined
								}
							>
								{tile.icon}
							</div>
							<div className='min-w-0 flex-1 pt-0.5'>
								<span className={cn(
									'block truncate text-sm font-medium tracking-tight',
									isActive ? 'text-foreground' : 'text-foreground/85'
								)}>
									{tile.name}
								</span>
								<span className='mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground/75'>
									{tile.description}
								</span>
							</div>
							{isActive && (
								<div
									className='mt-1 flex h-5 w-5 shrink-0 items-center justify-center border bg-background/60'
									style={{ borderColor: `color-mix(in srgb, ${theme.accent} 38%, transparent)` }}
								>
									<Check className='h-3 w-3 text-[var(--db-accent)]' strokeWidth={2.4} />
								</div>
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
