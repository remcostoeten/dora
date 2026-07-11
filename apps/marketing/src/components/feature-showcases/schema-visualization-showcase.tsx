'use client'

import { Key, LayoutGrid, Link2, Move, ScanSearch } from 'lucide-react'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'
import { useCycleIndex } from '@/components/feature-showcases/use-showcase-motion'

type TTableNode = {
    id: string
    name: string
    schema?: string
    x: number
    y: number
    columns: { name: string; type: string; pk?: boolean; fk?: boolean }[]
    selected?: boolean
}

const TABLES: TTableNode[] = [
    {
        id: 'customers',
        name: 'customers',
        x: 40,
        y: 28,
        columns: [
            { name: 'id', type: 'serial', pk: true },
            { name: 'name', type: 'varchar' },
            { name: 'email', type: 'varchar' }
        ],
        selected: true
    },
    {
        id: 'orders',
        name: 'orders',
        x: 280,
        y: 18,
        columns: [
            { name: 'id', type: 'serial', pk: true },
            { name: 'customer_id', type: 'int', fk: true },
            { name: 'total', type: 'numeric' },
            { name: 'status', type: 'varchar' }
        ]
    },
    {
        id: 'order_items',
        name: 'order_items',
        x: 520,
        y: 34,
        columns: [
            { name: 'id', type: 'serial', pk: true },
            { name: 'order_id', type: 'int', fk: true },
            { name: 'product_id', type: 'int', fk: true },
            { name: 'qty', type: 'int' }
        ]
    },
    {
        id: 'products',
        name: 'products',
        x: 280,
        y: 210,
        columns: [
            { name: 'id', type: 'serial', pk: true },
            { name: 'name', type: 'varchar' },
            { name: 'price', type: 'numeric' }
        ]
    }
]

const EDGES = [
    { from: 'customers', to: 'orders', label: 'customer_id' },
    { from: 'orders', to: 'order_items', label: 'order_id' },
    { from: 'products', to: 'order_items', label: 'product_id' }
]

function TableNodeCard({ table }: { table: TTableNode }) {
    const colorIndex = table.name.charCodeAt(0) % 5
    const colors = [
        'bg-emerald-500/20 text-emerald-400',
        'bg-blue-500/20 text-blue-400',
        'bg-orange-500/20 text-orange-400',
        'bg-purple-500/20 text-purple-400',
        'bg-red-500/20 text-red-400'
    ]

    return (
        <div
            className={
                'absolute w-[188px] overflow-hidden rounded-md border bg-card shadow-lg ' +
                (table.selected
                    ? 'border-primary/60 ring-1 ring-primary/30'
                    : 'border-sidebar-border')
            }
            style={{ left: table.x, top: table.y }}
        >
            <div className="flex items-center gap-2 border-b border-sidebar-border px-2.5 py-2">
                <div
                    className={
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ' +
                        colors[colorIndex]
                    }
                >
                    <LayoutGrid className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-zinc-200">
                        {table.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        {table.columns.length} columns
                    </div>
                </div>
            </div>
            <div className="py-0.5">
                {table.columns.map(function (col) {
                    return (
                        <div
                            key={col.name}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px]"
                        >
                            {col.pk ? (
                                <Key className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                            ) : col.fk ? (
                                <Link2 className="h-2.5 w-2.5 shrink-0 text-sky-400" />
                            ) : (
                                <span className="inline-block h-2.5 w-2.5 shrink-0" />
                            )}
                            <span className="truncate font-mono text-foreground/90">
                                {col.name}
                            </span>
                            <span className="ml-auto truncate text-muted-foreground/70">
                                {col.type}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function SchemaVisualizationShowcase() {
    const activeIndex = useCycleIndex(TABLES.length, 2600)
    const selected = TABLES[activeIndex] ?? TABLES[0]

    return (
        <>
            <FeatureShowcaseRail demo="schema-diagram" />
            <div className="grid min-w-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
                <aside className="flex flex-col border-r border-sidebar-border bg-sidebar p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Schema
                    </div>
                    <div className="mt-2">
                        <h3 className="text-sm font-semibold text-foreground">
                            Full map
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                            4 tables, 3 relationships
                        </p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                            { label: 'Tables', value: '4' },
                            { label: 'Relations', value: '3' },
                            { label: 'Schemas', value: '1' }
                        ].map(function (stat) {
                            return (
                                <div
                                    key={stat.label}
                                    className="rounded-[2px] border border-sidebar-border bg-background/40 px-2 py-2"
                                >
                                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                                        {stat.label}
                                    </div>
                                    <div className="text-sm font-medium text-foreground">
                                        {stat.value}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-4 rounded-[2px] border border-sidebar-border bg-background/40 p-2.5">
                        <div className="text-[10px] text-muted-foreground">
                            Selected table
                        </div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                            {selected.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {selected.columns.length} columns in public
                        </div>
                    </div>
                </aside>
                <div className="relative min-w-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in srgb, var(--color-brand-200) 6%, transparent),transparent_40%),var(--background)]">
                    <div className="flex h-10 items-center justify-between border-b border-sidebar-border px-3">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Move className="h-3.5 w-3.5" />
                            Pan and zoom
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 rounded-[2px] border border-sidebar-border px-2 py-1 text-[10px] text-muted-foreground">
                                <ScanSearch className="h-3 w-3" />
                                Search tables
                            </span>
                        </div>
                    </div>
                    <div className="relative h-[320px] overflow-hidden">
                        <div className="feature-showcase__schema-pan absolute inset-0">
                        <svg
                            className="pointer-events-none absolute inset-0 h-full w-full"
                            aria-hidden="true"
                        >
                            {EDGES.map(function (edge) {
                                const from = TABLES.find(function (t) {
                                    return t.id === edge.from
                                })!
                                const to = TABLES.find(function (t) {
                                    return t.id === edge.to
                                })!
                                const x1 = from.x + 188
                                const y1 = from.y + 48
                                const x2 = to.x
                                const y2 = to.y + 48
                                const midX = (x1 + x2) / 2
                                const isActive =
                                    edge.from === selected.id ||
                                    edge.to === selected.id
                                return (
                                    <path
                                        key={edge.from + edge.to}
                                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                                        fill="none"
                                        stroke={
                                            isActive
                                                ? 'color-mix(in srgb, var(--color-brand-200) 85%, transparent)'
                                                : 'color-mix(in srgb, var(--color-brand-600) 55%, transparent)'
                                        }
                                        strokeWidth={isActive ? 2.2 : 1.5}
                                        className={
                                            isActive
                                                ? 'feature-showcase__edge--active'
                                                : undefined
                                        }
                                    />
                                )
                            })}
                        </svg>
                        {TABLES.map(function (table) {
                            return (
                                <TableNodeCard
                                    key={table.id}
                                    table={{
                                        ...table,
                                        selected: table.id === selected.id
                                    }}
                                />
                            )
                        })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
