import { Database } from 'lucide-react'

type NoColumnsStateProps = {
	message?: string
}

export function NoColumnsState({ message }: NoColumnsStateProps) {
	return (
		<div className='flex flex-col items-center justify-center h-full gap-4 p-8'>
			<div className='flex h-16 w-16 items-center justify-center rounded-full bg-muted/50'>
				<Database className='h-8 w-8 text-muted-foreground/60' />
			</div>
			<div className='text-center space-y-1.5'>
				<h3 className='text-sm font-medium text-foreground'>No columns found</h3>
				<p className='text-xs text-muted-foreground max-w-[280px]'>
					{message ??
						"This table doesn't have any columns defined yet, or the schema couldn't be loaded."}
				</p>
			</div>
		</div>
	)
}

type NoRowsStateProps = {
	colSpan: number
}

export function NoRowsState({ colSpan }: NoRowsStateProps) {
	return (
		<tr>
			<td
				colSpan={colSpan}
				className='h-[400px] text-center text-muted-foreground border-b border-sidebar-border'
			>
				<div className='flex flex-col items-center justify-center gap-2'>
					<div className='p-3 rounded-full bg-sidebar-accent'>
						<Database className='h-6 w-6 opacity-50' />
					</div>
					<p className='font-medium'>No results found</p>
					<p className='text-sm opacity-80'>
						Try clearing filters or adding a new record
					</p>
				</div>
			</td>
		</tr>
	)
}
