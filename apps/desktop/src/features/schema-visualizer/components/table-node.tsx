import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Key, Link as LinkIcon } from 'lucide-react'
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
                <div className='flex-1 min-w-0'>
                    <div className='truncate text-xs font-semibold text-sidebar-foreground'>
                        {tableName}
                    </div>
                    {schemaLabel && (
                        <div className='truncate text-[10px] text-muted-foreground'>
                            {schemaLabel}
                        </div>
                    )}
                </div>
                {isMatch && matchedColumns.length > 0 && (
                    <span className='rounded-sm border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground'>
                        {matchedColumns.length} col
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

                            <div className='flex items-center gap-1 shrink-0 w-4'>
                                {isPk && (
                                    <Key className='h-2.5 w-2.5 text-[hsl(40_26%_58%)]' />
                                )}
                                {isFk && !isPk && (
                                    <LinkIcon className='h-2.5 w-2.5 text-[hsl(214_18%_60%)]' />
                                )}
                            </div>

                            <span
                                className={cn(
                                    'flex-1 truncate font-mono',
                                    isPk && 'font-semibold text-sidebar-foreground',
                                    !isPk && 'text-sidebar-foreground',
                                    isColMatch && 'text-sidebar-foreground',
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
