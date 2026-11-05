import { Columns3 } from 'lucide-react'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack, SearchIllustration } from '@studio/shared/ui/empty-state-illustrations'

type NoColumnsStateProps = {
	message?: string
}

export function NoColumnsState({ message }: NoColumnsStateProps) {
	return (
		<EmptyState
			size='sm'
			headingLevel='h3'
			loop
			illustration={<IconStack icon={<Columns3 />} />}
			title='No columns found'
			description={
				message ??
				"This table doesn't have any columns defined yet, or the schema couldn't be loaded."
			}
		/>
	)
}

type NoRowsStateProps = {
	colSpan: number
}

export function NoRowsState({ colSpan }: NoRowsStateProps) {
	return (
		<tr>
			<td colSpan={colSpan} className='h-[400px] border-b border-sidebar-border'>
				<EmptyState
					size='sm'
					headingLevel='h3'
					loop
					illustration={<SearchIllustration />}
					title='No results found'
					description='Try clearing filters or adding a new record.'
				/>
			</td>
		</tr>
	)
}
