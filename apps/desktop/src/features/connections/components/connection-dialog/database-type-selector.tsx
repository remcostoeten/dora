import { CheckCircle2 } from 'lucide-react'
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
				const isTypeDisabled = type === 'mysql' // Currently disabled in original code

				return (
					<button
						key={type}
						type='button'
						onClick={function () {
							if (!isTypeDisabled) onSelect(type)
						}}
						disabled={disabled || isTypeDisabled}
						className={cn(
							'db-card text-left',
							isActive && 'active',
							(disabled || isTypeDisabled) &&
								'opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border'
						)}
					>
						<div className='flex items-center gap-3'>
							<div
								className={cn(
									'db-card-icon bg-muted/50',
									(disabled || isTypeDisabled) && 'grayscale'
								)}
							>
								<DatabaseIcon type={type} className='h-5 w-5' />
							</div>
							<div className='flex-1 min-w-0'>
								<div className='flex items-center gap-2'>
									<span className='font-medium text-sm truncate'>
										{meta.name}
									</span>
									{isTypeDisabled && (
										<span className='text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground'>
											Soon
										</span>
									)}
								</div>
								<div className='text-xs text-muted-foreground truncate'>
									{meta.description}
								</div>
							</div>
							{isActive && !isTypeDisabled && (
								<CheckCircle2 className='h-4 w-4 text-primary shrink-0' />
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
