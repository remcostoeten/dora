import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KeyRound, Link2, Table2 } from 'lucide-react'
import { memo } from 'react'
import type { ColumnInfo } from '@studio/lib/bindings'
import { cn } from '@studio/shared/utils/cn'
import type { TableNodeData } from '../hooks/use-schema-graph'
import { isIndexedColumn, isPrimaryKeyColumn } from '../utils/schema-insights'

type Props = NodeProps & { data: TableNodeData }

function ColumnGlyph({ data, column }: { data: TableNodeData; column: ColumnInfo }) {
	const isPk = isPrimaryKeyColumn(data, column)
	if (column.foreign_key) {
		const hue = data.referenceHues[column.name]
		const Icon = isPk ? KeyRound : Link2
		return (
			<span
				className={cn('sv-glyph', hue && `sv-text-${hue}`)}
				title={`References ${column.foreign_key.referenced_table}.${column.foreign_key.referenced_column}`}
			>
				<Icon className='h-3 w-3' strokeWidth={2} />
			</span>
		)
	}
	if (isPk) {
		return (
			<span className='sv-glyph sv-glyph--pk' title='Primary key'>
				<KeyRound className='h-3 w-3' strokeWidth={2} />
			</span>
		)
	}
	if (isIndexedColumn(data, column)) {
		return (
			<span className='sv-glyph' title='Indexed'>
				<span className='sv-glyph__dot' />
			</span>
		)
	}
	return <span className='sv-glyph' />
}

function TableNodeInner({ data, selected }: Props) {
	const { tableId, tableName, columns, searchState, matchedColumns, pulseState, focusState } =
		data
	const rowCount =
		data.rowCountEstimate !== null && data.rowCountEstimate >= 0
			? ` · ${data.rowCountEstimate.toLocaleString()} rows`
			: ''

	return (
		<div
			className={cn(
				'sv-node',
				data.hue && `sv-hue-${data.hue}`,
				(selected || focusState === 'selected') && 'sv-node--selected',
				(searchState === 'dim' || focusState === 'dim') && 'sv-node--dim',
				searchState === 'context' && 'sv-node--context',
				pulseState !== 'idle' && `sv-node--pulse sv-node--pulse-${pulseState}`
			)}
			style={{ width: data.width }}
		>
			<div className='sv-node__header'>
				<span className='sv-icon-box'>
					<Table2 className='h-3.5 w-3.5' />
				</span>
				<div className='min-w-0'>
					<div className='sv-node__name' title={tableName}>
						{tableName}
					</div>
					<div className='sv-node__meta'>
						{columns.length === 1 ? '1 column' : `${columns.length} columns`}
						{rowCount}
					</div>
				</div>
				{searchState === 'match' && matchedColumns.length > 0 && (
					<span className='sv-node__matches'>{matchedColumns.length}</span>
				)}
			</div>

			<div className='sv-node__columns'>
				{columns.map(function (column) {
					const isMatch = matchedColumns.includes(column.name)
					return (
						<div
							key={column.name}
							className={cn(
								'sv-node__column',
								isMatch && 'sv-node__column--match',
								column.foreign_key && 'sv-node__column--link'
							)}
							title={`${column.name} ${column.data_type}${column.is_nullable ? ', nullable' : ''}`}
						>
							<Handle
								type='target'
								position={Position.Left}
								id={`${tableId}__${column.name}__target`}
								className='sv-handle'
								isConnectable={false}
							/>
							<ColumnGlyph data={data} column={column} />
							<span className='sv-node__column-name'>{column.name}</span>
							<span className='sv-node__column-type'>
								{column.data_type}
								{column.is_nullable && <span className='sv-nullable'>?</span>}
							</span>
							<Handle
								type='source'
								position={Position.Right}
								id={`${tableId}__${column.name}__source`}
								className='sv-handle'
								isConnectable={false}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export const TableNode = memo(TableNodeInner)
