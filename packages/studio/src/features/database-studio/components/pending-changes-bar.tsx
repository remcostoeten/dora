import { useRef } from 'react'
import { Check, X, Edit3 } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Button } from '@studio/shared/ui/button'
import { usePresence } from '@studio/shared/hooks/use-presence'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	editCount: number
	isApplying?: boolean
	onApply: () => void
	onCancel: () => void
	className?: string
}

export function PendingChangesBar({ editCount, isApplying, onApply, onCancel, className }: Props) {
	const open = editCount > 0
	const { present, state } = usePresence(open, 200)
	const lastCountRef = useRef(editCount)
	if (editCount > 0) {
		lastCountRef.current = editCount
	}
	const displayCount = editCount > 0 ? editCount : lastCountRef.current

	if (!present) return null

	return (
		<div
			data-state={state}
			className='grid grid-rows-[0fr] opacity-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-[opacity]'
		>
			<div className='overflow-hidden'>
				<div
					className={cn(
						'flex items-center justify-between gap-4 px-4 py-2 bg-primary/10 border-t border-primary/20',
						className
					)}
				>
					<div className='flex items-center gap-2 text-sm'>
						<Edit3 className='h-4 w-4 text-primary' />
						<span className='font-medium'>
							Edited <span className='text-primary'>{displayCount}</span>{' '}
							{displayCount === 1 ? 'cell' : 'cells'}
						</span>
						<span className='text-muted-foreground'>(changes not saved)</span>
					</div>

					<div className='flex items-center gap-2'>
						<Button
							variant='ghost'
							size='sm'
							onClick={onCancel}
							disabled={isApplying}
							className='gap-1.5'
						>
							<X className='h-4 w-4' />
							Discard
						</Button>
						<Button size='sm' onClick={onApply} disabled={isApplying} className='gap-1.5'>
							{isApplying ? (
								<Spinner className='h-4 w-4' />
							) : (
								<Check className='h-4 w-4' />
							)}
							Apply Changes
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
