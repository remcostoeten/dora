import { Loader2, Check, X, Edit3 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type Props = {
	editCount: number
	isApplying?: boolean
	onApply: () => void
	onCancel: () => void
	className?: string
}

export function PendingChangesBar({ editCount, isApplying, onApply, onCancel, className }: Props) {
	if (editCount === 0) return null

	return (
		<div
			className={cn(
				'flex items-center justify-between gap-4 px-4 py-2 bg-primary/10 border-t border-primary/20',
				className
			)}
		>
			<div className='flex items-center gap-2 text-sm'>
				<Edit3 className='h-4 w-4 text-primary' />
				<span className='font-medium'>
					Edited <span className='text-primary'>{editCount}</span>{' '}
					{editCount === 1 ? 'cell' : 'cells'}
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
						<Loader2 className='h-4 w-4 animate-spin' />
					) : (
						<Check className='h-4 w-4' />
					)}
					Apply Changes
				</Button>
			</div>
		</div>
	)
}
