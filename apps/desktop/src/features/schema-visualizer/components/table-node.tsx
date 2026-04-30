import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { Key, Link, Hash, LayoutGrid } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'

type Props = NodeProps & { data: TableNodeData }

function TableNodeInner({ data, selected }: Props) {
	const {
		tableId,
		tableName,
		schema,
		columns,
		primaryKeyColumns,
		searchState,
		matchedColumns,
		pulseState,
	} = data
	const isMatch = searchState === 'match'
	const isContext = searchState === 'context'
	const isDim = searchState === 'dim'
	const isPulsing = pulseState !== 'idle'
	const schemaLabel = schema && schema !== 'public' ? schema : null
	const rowCountLabel = columns.length === 1 ? '1 column' : `${columns.length} columns`

	return (
		<div
			className={cn(
				'sv-table-node',
				selected && 'sv-table-node--selected',
				isMatch && 'sv-table-node--match',
				isContext && 'sv-table-node--context',
				isDim && 'sv-table-node--dim',
				isPulsing && 'sv-table-node--pulse',
				pulseState === 'insert' && 'sv-table-node--pulse-insert',
				pulseState === 'update' && 'sv-table-node--pulse-update',
				pulseState === 'delete' && 'sv-table-node--pulse-delete',
			)}
		>
			<div
				className={cn(
					'sv-table-node__header',
					isMatch && 'sv-table-node__header--match',
					isContext && 'sv-table-node__header--context',
				)}
			>
				{/* Colorful Icon Box */}
				<div className={cn(
					'sv-table-node__icon-box',
					// Assign a consistent color class based on the first letter of the table name
					['bg-emerald-500/20 text-emerald-400', 'bg-blue-500/20 text-blue-400', 'bg-orange-500/20 text-orange-400', 'bg-purple-500/20 text-purple-400', 'bg-red-500/20 text-red-400'][
						tableName.charCodeAt(0) % 5
					]
				)}>
					<LayoutGrid className="w-4 h-4" />
				</div>
				<div className='min-w-0 flex-1 flex flex-col justify-center'>
					<div className='truncate text-[13px] font-semibold text-zinc-200 tracking-wide'>
						{tableName}
					</div>
					<div className='sv-table-node__meta'>
						{schemaLabel && <span className='sv-table-node__schema'>{schemaLabel}</span>}
						<span className='sv-table-node__count'>{rowCountLabel}</span>
					</div>
				</div>
				{isMatch && matchedColumns.length > 0 && (
					<span className='sv-table-node__match-count'>
						{matchedColumns.length} match{matchedColumns.length === 1 ? '' : 'es'}
					</span>
				)}
			</div>

			<div className='flex flex-col'>
				{columns.map(function (col) {
					const isPk =
						col.is_primary_key || primaryKeyColumns.includes(col.name)
					const isFk = col.foreign_key !== null
					const sourceHandleId = `${tableId}__${col.name}__source`
					const targetHandleId = `${tableId}__${col.name}__target`
					const isColMatch = matchedColumns.includes(col.name)
					const roleLabel = isPk ? 'PK' : isFk ? 'FK' : 'COL'

					return (
						<div
							key={col.name}
							className={cn(
								'sv-table-node__row',
								isColMatch && 'sv-table-node__row--match',
							)}
						>
							<Handle
								type='target'
								position={Position.Left}
								id={targetHandleId}
								className={cn(
									'sv-handle sv-handle--target',
									isFk && 'sv-handle--fk',
									isColMatch && 'sv-handle--active',
								)}
							/>

							<div className='sv-table-node__column-main'>
								<div className="w-4 flex justify-center text-zinc-500">
									{isPk ? (
										<Key className="w-3 h-3 text-amber-500/80" />
									) : isFk ? (
										<Link className="w-3 h-3 text-blue-500/80" />
									) : (
										<Hash className="w-3 h-3 text-zinc-600" />
									)}
								</div>
								<span
									className={cn(
										'truncate font-mono text-[11px]',
										isPk ? 'font-medium text-zinc-300' : 'text-zinc-400',
										isColMatch && 'text-zinc-200',
									)}
								>
									{col.name}
								</span>
							</div>

							<span
								className={cn(
									'sv-table-node__type',
									col.is_nullable
										? 'text-zinc-600'
										: 'text-zinc-500',
								)}
							>
								{col.data_type}
							</span>

							<Handle
								type='source'
								position={Position.Right}
								id={sourceHandleId}
								className={cn(
									'sv-handle sv-handle--source',
									isFk && 'sv-handle--fk',
									isColMatch && 'sv-handle--active',
								)}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export const TableNode = memo(TableNodeInner)
