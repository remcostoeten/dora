'use client'

import { Plus, X } from 'lucide-react'
import type { TDemoColumn } from '@/components/hero-app-demo-tables'
import { DemoSelect } from '@/components/hero-app-demo-menus'

/**
 * Working replica of the real filter-bar strip: WHERE / AND-OR prefixed
 * condition rows (column + operator + value), a live monospace WHERE-clause
 * preview and a Clear button. Conditions genuinely filter the demo grid.
 */

export type TFilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt'

export type TFilterCondition = {
    id: number
    column: string
    op: TFilterOp
    value: string
}

export type TConjunction = 'AND' | 'OR'

const OP_LABELS: Record<TFilterOp, string> = {
    eq: 'equals',
    neq: 'not equal',
    contains: 'contains',
    gt: 'greater than',
    lt: 'less than'
}

const OP_SQL: Record<TFilterOp, string> = {
    eq: '=',
    neq: '!=',
    contains: 'ILIKE',
    gt: '>',
    lt: '<'
}

const OP_OPTIONS = (Object.keys(OP_LABELS) as TFilterOp[]).map((op) => ({
    value: op,
    label: OP_LABELS[op]
}))

function compare(cell: string, value: string, op: TFilterOp): boolean {
    const cellNumber = Number(cell)
    const valueNumber = Number(value)
    const numeric =
        cell !== '' &&
        value !== '' &&
        !Number.isNaN(cellNumber) &&
        !Number.isNaN(valueNumber)
    switch (op) {
        case 'eq':
            return cell.toLowerCase() === value.toLowerCase()
        case 'neq':
            return cell.toLowerCase() !== value.toLowerCase()
        case 'contains':
            return cell.toLowerCase().includes(value.toLowerCase())
        case 'gt':
            return numeric ? cellNumber > valueNumber : cell > value
        case 'lt':
            return numeric ? cellNumber < valueNumber : cell < value
    }
}

export function activeConditions(
    conditions: TFilterCondition[]
): TFilterCondition[] {
    return conditions.filter((condition) => condition.value.trim() !== '')
}

export function rowPasses(
    conditions: TFilterCondition[],
    conjunction: TConjunction,
    columns: TDemoColumn[],
    row: string[]
): boolean {
    const active = activeConditions(conditions)
    if (active.length === 0) return true
    const matches = active.map((condition) => {
        const index = columns.findIndex(
            (column) => column.name === condition.column
        )
        if (index < 0) return true
        return compare(row[index] ?? '', condition.value.trim(), condition.op)
    })
    if (conjunction === 'AND') return matches.every(Boolean)
    return matches.some(Boolean)
}

export function whereClause(
    conditions: TFilterCondition[],
    conjunction: TConjunction
): string {
    const active = activeConditions(conditions)
    if (active.length === 0) return ''
    return (
        'WHERE ' +
        active
            .map((condition) => {
                const value =
                    condition.op === 'contains'
                        ? `'%${condition.value.trim()}%'`
                        : `'${condition.value.trim()}'`
                return `${condition.column} ${OP_SQL[condition.op]} ${value}`
            })
            .join(` ${conjunction} `)
    )
}

type Props = {
    columns: TDemoColumn[]
    conditions: TFilterCondition[]
    conjunction: TConjunction
    onConditionsChange: (conditions: TFilterCondition[]) => void
    onConjunctionToggle: () => void
    onClear: () => void
}

export function FilterBar({
    columns,
    conditions,
    conjunction,
    onConditionsChange,
    onConjunctionToggle,
    onClear
}: Props) {
    const columnOptions = columns.map((column) => ({
        value: column.name,
        label: column.name
    }))
    const preview = whereClause(conditions, conjunction)

    function addCondition() {
        const nextId =
            conditions.reduce(
                (max, condition) => Math.max(max, condition.id),
                0
            ) + 1
        onConditionsChange([
            ...conditions,
            { id: nextId, column: columns[0].name, op: 'eq', value: '' }
        ])
    }

    function patchCondition(id: number, patch: Partial<TFilterCondition>) {
        onConditionsChange(
            conditions.map((condition) =>
                condition.id === id ? { ...condition, ...patch } : condition
            )
        )
    }

    function removeCondition(id: number) {
        onConditionsChange(
            conditions.filter((condition) => condition.id !== id)
        )
    }

    return (
        <div className="shrink-0 border-b border-sidebar-border bg-sidebar-accent/10 px-2 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
            <div className="flex flex-col gap-1.5">
                {conditions.map((condition, index) => (
                    <div
                        key={condition.id}
                        className="flex items-center gap-1.5"
                    >
                        <button
                            type="button"
                            onClick={() => removeCondition(condition.id)}
                            aria-label="Remove condition"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                        {index === 0 ? (
                            <span className="flex h-7 w-12 shrink-0 items-center justify-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Where
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={onConjunctionToggle}
                                className="flex h-7 w-12 shrink-0 items-center justify-center rounded-[2px] border border-primary/40 text-[10px] font-medium uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
                            >
                                {conjunction}
                            </button>
                        )}
                        <DemoSelect
                            value={condition.column}
                            options={columnOptions}
                            ariaLabel="Filter column"
                            onChange={(column) =>
                                patchCondition(condition.id, { column })
                            }
                        />
                        <DemoSelect
                            value={condition.op}
                            options={OP_OPTIONS}
                            ariaLabel="Filter operator"
                            onChange={(op) =>
                                patchCondition(condition.id, {
                                    op: op as TFilterOp
                                })
                            }
                        />
                        <input
                            value={condition.value}
                            onChange={(event) =>
                                patchCondition(condition.id, {
                                    value: event.target.value
                                })
                            }
                            placeholder="Value..."
                            className="h-7 w-[180px] rounded-[2px] border border-input bg-background/40 px-2 text-[11px] text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/60 focus:border-sidebar-border"
                        />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
                <button
                    type="button"
                    onClick={addCondition}
                    className="inline-flex h-6 items-center gap-1 rounded-[2px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                    <Plus className="h-3 w-3" />
                    Add condition
                </button>
                <span className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-muted-foreground/70">
                    {preview}
                </span>
                {conditions.length > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex h-6 shrink-0 items-center rounded-[2px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                        Clear filters
                    </button>
                )}
            </div>
        </div>
    )
}
