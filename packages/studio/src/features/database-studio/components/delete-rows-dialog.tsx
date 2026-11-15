import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@studio/shared/ui/alert-dialog'
import { memoWhileClosed } from '../utils/memo-while-closed'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	target: string
	onConfirm: () => void
}

export const DeleteRowsDialog = memoWhileClosed(function DeleteRowsDialog({
	open,
	onOpenChange,
	target,
	onConfirm
}: Props) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This will permanently delete {target} from the
						database.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={function handleConfirmDelete(event) {
							event.preventDefault()
							onConfirm()
						}}
						className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
})
