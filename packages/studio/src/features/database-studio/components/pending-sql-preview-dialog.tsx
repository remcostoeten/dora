import { Button } from '@studio/shared/ui/button'
import { memoWhileClosed } from '../utils/memo-while-closed'
import { StudioDialog } from './studio-dialog'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	statements: string[]
	onApply?: () => void
	onReturnFocus?: () => void
}

export const PendingSqlPreviewDialog = memoWhileClosed(function PendingSqlPreviewDialog({
	open,
	onOpenChange,
	statements,
	onApply,
	onReturnFocus
}: Props) {
	const sql = statements.join('\n')

	return (
		<StudioDialog
			open={open}
			onOpenChange={onOpenChange}
			title='Staged edits as SQL'
			description='Equivalent statements for the staged edits. Dora applies them with bound parameters, so the text that reaches the database can differ.'
			className='sm:max-w-[640px]'
			onCloseAutoFocus={(event) => {
				if (!onReturnFocus) return
				event.preventDefault()
				onReturnFocus()
			}}
			footer={
				<>
					<Button
						variant='ghost'
						size='sm'
						disabled={statements.length === 0}
						onClick={() => navigator.clipboard.writeText(sql)}
					>
						Copy SQL
					</Button>
					{onApply && (
						<Button
							size='sm'
							disabled={statements.length === 0}
							onClick={() => {
								onOpenChange(false)
								onApply()
							}}
						>
							Apply changes
						</Button>
					)}
				</>
			}
		>
			{statements.length === 0 ? (
				<p className='text-sm text-muted-foreground'>No staged edits.</p>
			) : (
				<ol
					tabIndex={0}
					aria-label={`${statements.length} staged ${statements.length === 1 ? 'statement' : 'statements'}`}
					className='max-h-[50vh] overflow-auto rounded-md border border-sidebar-border bg-background p-3 font-mono text-xs focus-visible:bg-focus'
				>
					{statements.map((statement) => (
						<li key={statement} className='whitespace-pre-wrap break-all py-0.5'>
							{statement}
						</li>
					))}
				</ol>
			)}
		</StudioDialog>
	)
})
