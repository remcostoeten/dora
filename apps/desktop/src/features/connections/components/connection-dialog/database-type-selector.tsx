import { cn } from '@/shared/utils/cn'
import { DatabaseType } from '../../types'
import { DatabaseIcon, DATABASE_META } from '../database-icons'

type Props = {
	selectedType: DatabaseType
	onSelect: (type: DatabaseType) => void
	disabled?: boolean
}

const DATABASE_TYPES: DatabaseType[] = ['postgres', 'mysql', 'sqlite', 'libsql']

export function DatabaseTypeSelector({ selectedType, onSelect, disabled }: Props) {
	return (
		<div className='grid grid-cols-2 gap-2'>
			{DATABASE_TYPES.map(function (type) {
				const meta = DATABASE_META[type]
				const isActive = selectedType === type

				return (
					<button
						key={type}
						type='button'
						onClick={function () {
							onSelect(type)
						}}
						disabled={disabled}
						className={cn(
							'db-card text-left',
							isActive && 'active',
							disabled &&
								'opacity-50 cursor-not-allowed hover:bg-background/40 hover:border-border/60'
						)}
					>
						<div className='flex items-center gap-3'>
							<div
								className={cn('db-card-icon bg-muted/40', disabled && 'grayscale')}
							>
								<DatabaseIcon type={type} className='h-5 w-5' />
							</div>
							<div className='flex-1 min-w-0'>
								<span className='font-medium text-sm block truncate'>
									{meta.name}
								</span>
								<span className='text-xs text-muted-foreground block truncate'>
									{meta.description}
								</span>
							</div>
							{isActive && (
								<span className='h-1.5 w-1.5 rounded-full bg-primary shrink-0' />
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
