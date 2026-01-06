'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Database, Key, Link } from 'lucide-react'
import { cn } from '@/core/utilities/cn'

export type SchemaTableNodeData = {
    tableName: string
    schema: string
    columns: Array<{
        name: string
        type: string
        constraints: string[]
    }>
}

export const SchemaTableNode = memo(({ data, selected }: NodeProps<SchemaTableNodeData>) => {
    const { tableName, schema, columns } = data

    const hasPrimaryKey = columns.some((col) => col.constraints.includes('PK'))
    const hasForeignKey = columns.some((col) => col.constraints.some((c) => c.includes('FK')))

    return (
        <div
            className={cn(
                'min-w-[250px] rounded-lg border-2 bg-card shadow-lg transition-all',
                selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
            )}
        >
            {/* Table Header */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                    <div className="font-semibold text-foreground">{tableName}</div>
                    {schema && schema !== 'public' && (
                        <div className="text-xs text-muted-foreground">{schema}</div>
                    )}
                </div>
                <div className="flex gap-1">
                    {hasPrimaryKey && (
                        <div title="Has primary key">
                            <Key className="h-3.5 w-3.5 text-primary" />
                        </div>
                    )}
                    {hasForeignKey && (
                        <div title="Has foreign keys">
                            <Link className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </div>

            {/* Columns List */}
            <div className="max-h-[400px] overflow-y-auto">
                {columns.map((column, index) => {
                    const isPK = column.constraints.includes('PK')
                    const fkConstraint = column.constraints.find((c) => c.includes('FK'))
                    const isNotNull = column.constraints.includes('NOT NULL')

                    return (
                        <div
                            key={column.name}
                            className={cn(
                                'flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-b-0',
                                isPK && 'bg-primary/5'
                            )}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                {isPK && <Key className="h-3 w-3 shrink-0 text-primary" />}
                                <span className="truncate font-medium text-foreground">{column.name}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{column.type}</span>
                                {isNotNull && !isPK && (
                                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                                        NN
                                    </span>
                                )}
                                {fkConstraint && (
                                    <div title={fkConstraint}>
                                        <Link className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Connection Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="h-3 w-3 border-2 border-background bg-primary"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="h-3 w-3 border-2 border-background bg-primary"
            />
        </div>
    )
})

SchemaTableNode.displayName = 'SchemaTableNode'
