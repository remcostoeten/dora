import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { StudioDialog } from './studio-dialog'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	tableName: string
	columnName: string
	onConfirm: () => void
	isLoading?: boolean
}

export function DropColumnDialog({
	open,
	onOpenChange,
	tableName,
	columnName,
	onConfirm,
	isLoading
}: Props) {
	const [confirmText, setConfirmText] = useState('')

	useEffect(
		function resetOnClose() {
			if (!open) {
				setConfirmText('')
			}
		},
		[open]
	)

	const isConfirmed = confirmText === columnName

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!isConfirmed) return
		onConfirm()
	}

	return (
		<StudioDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				<div className='flex items-center gap-3'>
					<div className='flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10'>
						<AlertTriangle className='h-5 w-5 text-destructive' />
					</div>
					<div>
						<div className='font-semibold'>Drop Column</div>
						<div className='text-sm font-normal text-muted-foreground'>
							This action cannot be undone.
						</div>
					</div>
				</div>
			}
			contentClassName='space-y-4'
			footer={
				<>
					<Button
						type='button'
						variant='outline'
						onClick={function () {
							onOpenChange(false)
						}}
					>
						Cancel
					</Button>
					<Button
						type='submit'
						variant='destructive'
						disabled={isLoading || !isConfirmed}
						form='drop-column-form'
					>
						{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
						Drop Column
					</Button>
				</>
			}
		>
			<form id='drop-column-form' onSubmit={handleSubmit} className='space-y-4'>
				<div className='rounded-lg border border-destructive/50 bg-destructive/5 p-4'>
					<p className='text-sm text-foreground'>
						You are about to permanently delete the column{' '}
						<span className='font-mono font-semibold text-destructive'>{columnName}</span>{' '}
						from <span className='font-mono font-semibold'>{tableName}</span> and all of its
						data.
					</p>
				</div>

				<div className='space-y-2'>
					<Label htmlFor='confirm-column-name'>
						Type <span className='font-mono font-semibold'>{columnName}</span> to confirm
					</Label>
					<Input
						id='confirm-column-name'
						value={confirmText}
						onChange={function (e) {
							setConfirmText(e.target.value)
						}}
						placeholder={columnName}
						className='font-mono'
						autoFocus
					/>
				</div>
			</form>
		</StudioDialog>
	)
}
