import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	currentName: string
	onConfirm: (newName: string) => void
	isLoading?: boolean
}

export function RenameTableDialog({
	open,
	onOpenChange,
	currentName,
	onConfirm,
	isLoading
}: Props) {
	const [newName, setNewName] = useState(currentName)

	useEffect(
		function syncAndFocus() {
			if (open) {
				setNewName(currentName)
				// Small timeout to ensure dialog animation doesn't interfere with focus/selection
				setTimeout(function () {
					const input = document.getElementById('new-table-name') as HTMLInputElement
					if (input) {
						input.focus()
						const len = input.value.length
						input.setSelectionRange(len, len)
					}
				}, 100)
			}
		},
		[open, currentName]
	)

	const isValid = newName.trim() && newName.trim() !== currentName

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!isValid) return
		onConfirm(newName.trim())
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[400px]'>
				<DialogHeader>
					<DialogTitle>Rename Table</DialogTitle>
					<DialogDescription>
						Change the name of{' '}
						<span className='font-mono text-primary'>{currentName}</span>
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='space-y-4 py-4'>
					<div className='space-y-2'>
						<Label htmlFor='new-table-name'>New Name</Label>
						<Input
							id='new-table-name'
							value={newName}
							onChange={function (e) {
								setNewName(e.target.value)
							}}
							placeholder='table_name'
							className='font-mono'
						/>
					</div>

					<DialogFooter className='pt-4'>
						<Button
							type='button'
							variant='outline'
							onClick={function () {
								onOpenChange(false)
							}}
						>
							Cancel
						</Button>
						<Button type='submit' disabled={isLoading || !isValid}>
							{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
							Rename
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
