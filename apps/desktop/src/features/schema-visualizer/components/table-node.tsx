import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
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
	} = data
	const isMatch = searchState === 'match'
	const isContext = searchState === 'context'
	const isDim = searchState === 'dim'
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
			)}
		>
			<div
				className={cn(
					'sv-table-node__header',
					isMatch && 'sv-table-node__header--match',
					isContext && 'sv-table-node__header--context',
				)}
			>
				<div className='min-w-0 flex-1'>
					<div className='sv-table-node__meta'>
						{schemaLabel && <span className='sv-table-node__schema'>{schemaLabel}</span>}
						<span className='sv-table-node__count'>{rowCountLabel}</span>
					</div>
					<div className='truncate text-sm font-semibold text-sidebar-foreground'>
						{tableName}
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
								<span
									className={cn(
										'sv-table-node__role',
										isPk && 'sv-table-node__role--pk',
										!isPk && isFk && 'sv-table-node__role--fk',
									)}
								>
									{roleLabel}
								</span>
								<span
									className={cn(
										'truncate font-mono text-[11px]',
										isPk ? 'font-semibold text-sidebar-foreground' : 'text-sidebar-foreground/92',
										isColMatch && 'text-sidebar-foreground',
									)}
								>
									{col.name}
								</span>
							</div>

							<span
								className={cn(
									'sv-table-node__type',
									col.is_nullable
										? 'text-muted-foreground'
										: 'text-sidebar-foreground/74',
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
