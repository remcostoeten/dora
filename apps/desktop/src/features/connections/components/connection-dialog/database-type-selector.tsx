import { cn } from '@/shared/utils/cn'
import { DatabaseType } from '../../types'
import { DatabaseIcon, DATABASE_META } from '../database-icons'

type Props = {
	selectedType: DatabaseType
	onSelect: (type: DatabaseType) => void
	disabled?: boolean
}

const DATABASE_TYPES: DatabaseType[] = ['postgres', 'mysql', 'sqlite', 'libsql']

const TYPE_ACCENT: Record<DatabaseType, string> = {
	postgres: 'hsl(214 100% 60%)',
	mysql:    'hsl(36 100% 55%)',
	sqlite:   'hsl(142 71% 45%)',
	libsql:   'hsl(260 80% 65%)',
}

export function DatabaseTypeSelector({ selectedType, onSelect, disabled }: Props) {
	return (
		<div className='grid grid-cols-2 gap-2'>
			{DATABASE_TYPES.map(function (type) {
				const meta = DATABASE_META[type]
				const isActive = selectedType === type
				const accent = TYPE_ACCENT[type]

				return (
					<button
						key={type}
						type='button'
						onClick={function () {
							onSelect(type)
						}}
						disabled={disabled}
						style={isActive ? { '--db-accent': accent } as React.CSSProperties : undefined}
						className={cn(
							'db-type-btn group relative text-left overflow-hidden rounded-lg transition-all duration-200',
							'border bg-card/60 hover:bg-card',
							isActive
								? 'border-[var(--db-accent)]/50 bg-card shadow-md ring-1 ring-[var(--db-accent)]/30'
								: 'border-border/50 hover:border-border',
							disabled && 'opacity-50 cursor-not-allowed'
						)}
					>
						{/* Active accent glow strip */}
						{isActive && (
							<div
								className='absolute inset-x-0 top-0 h-[2px]'
								style={{ background: `var(--db-accent)` }}
							/>
						)}

						<div className='flex items-center gap-3 px-3 py-3'>
							<div
								className={cn(
									'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
									isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'
								)}
								style={isActive ? { background: `color-mix(in srgb, ${accent} 14%, transparent)` } : undefined}
							>
								<DatabaseIcon type={type} className='h-5 w-5' />
							</div>
							<div className='min-w-0 flex-1'>
								<span className={cn(
									'block text-sm font-medium truncate',
									isActive ? 'text-foreground' : 'text-foreground/80'
								)}>
									{meta.name}
								</span>
								<span className='block text-xs text-muted-foreground/70 truncate'>
									{meta.description}
								</span>
							</div>
							{isActive && (
								<div
									className='h-1.5 w-1.5 shrink-0 rounded-full'
									style={{ background: accent }}
								/>
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
