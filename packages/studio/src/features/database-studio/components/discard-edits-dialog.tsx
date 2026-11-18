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
	editCount: number
	onConfirm: () => void
	onReturnFocus?: () => void
}

export const DiscardEditsDialog = memoWhileClosed(function DiscardEditsDialog({
	open,
	onOpenChange,
	editCount,
	onConfirm,
	onReturnFocus
}: Props) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				onCloseAutoFocus={(event) => {
					if (!onReturnFocus) return
					event.preventDefault()
					onReturnFocus()
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Discard {editCount} staged {editCount === 1 ? 'edit' : 'edits'}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						The staged edits were never written to the database. Discarding them reloads
						the table and cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep editing</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
})
