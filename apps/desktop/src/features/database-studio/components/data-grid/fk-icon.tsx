import { ArrowUpRight } from 'lucide-react'
import type { ForeignKeyRef } from '../../types'

type Props = {
	foreignKey: ForeignKeyRef
	cellValue: unknown
	onNavigate: (referencedTable: string, referencedColumn: string, value: unknown, schema?: string) => void
}

export function FKNavigateIcon({ foreignKey, cellValue, onNavigate }: Props) {
	if (cellValue === null || cellValue === undefined) return null

	return (
		<button
			aria-label={`Navigate to ${foreignKey.referencedTable}`}
			onClick={(e) => {
				e.stopPropagation()
				onNavigate(foreignKey.referencedTable, foreignKey.referencedColumn, cellValue, foreignKey.referencedSchema)
			}}
			className='opacity-0 group-hover/cell:opacity-100 ml-1 shrink-0 rounded p-0.5 text-primary/60 hover:text-primary hover:bg-primary/10 transition-opacity'
		>
			<ArrowUpRight className='h-3 w-3' />
		</button>
	)
}
