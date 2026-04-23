import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Key, Link as LinkIcon, Table } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'

type Props = NodeProps & { data: TableNodeData }

function TableNodeInner({ data, selected }: Props) {
	const { tableName, schema, columns, primaryKeyColumns, rowCountEstimate } = data

	return (
		<div
			className={cn(
				'w-[280px] rounded-md border bg-sidebar shadow-sm overflow-hidden',
				selected
					? 'border-primary ring-2 ring-primary/30'
					: 'border-sidebar-border',
			)}
		>
			<div className='flex items-center gap-2 px-3 py-2 bg-sidebar-accent border-b border-sidebar-border'>
				<Table className='h-3.5 w-3.5 text-primary shrink-0' />
				<div className='flex-1 min-w-0'>
					<div className='text-xs font-semibold text-sidebar-foreground truncate'>
						{tableName}
					</div>
					{schema && (
						<div className='text-[10px] text-muted-foreground truncate'>
							{schema}
						</div>
					)}
				</div>
				{rowCountEstimate !== null && (
					<span className='text-[10px] text-muted-foreground'>
						~{rowCountEstimate} rows
					</span>
				)}
			</div>

			<div className='flex flex-col'>
				{columns.map(function (col) {
					const isPk =
						col.is_primary_key || primaryKeyColumns.includes(col.name)
					const isFk = col.foreign_key !== null
					const sourceHandleId = `${tableName}__${col.name}__source`
					const targetHandleId = `${tableName}__${col.name}__target`

					return (
						<div
							key={col.name}
							className='relative flex items-center gap-2 px-3 h-6 text-[11px] border-b border-sidebar-border/50 last:border-b-0 hover:bg-sidebar-accent/40'
						>
							<Handle
								type='target'
								position={Position.Left}
								id={targetHandleId}
								className='!w-2 !h-2 !bg-primary !border-sidebar'
								style={{ left: -4 }}
							/>

							<div className='flex items-center gap-1 shrink-0 w-4'>
								{isPk && (
									<Key className='h-2.5 w-2.5 text-yellow-500' />
								)}
								{isFk && !isPk && (
									<LinkIcon className='h-2.5 w-2.5 text-blue-500' />
								)}
							</div>

							<span
								className={cn(
									'font-mono truncate flex-1',
									isPk && 'font-semibold text-sidebar-foreground',
									!isPk && 'text-sidebar-foreground',
								)}
							>
								{col.name}
							</span>

							<span
								className={cn(
									'font-mono text-[10px] shrink-0',
									col.is_nullable
										? 'text-muted-foreground'
										: 'text-sidebar-foreground/70',
								)}
							>
								{col.data_type}
							</span>

							<Handle
								type='source'
								position={Position.Right}
								id={sourceHandleId}
								className='!w-2 !h-2 !bg-primary !border-sidebar'
								style={{ right: -4 }}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export const TableNode = memo(TableNodeInner)
