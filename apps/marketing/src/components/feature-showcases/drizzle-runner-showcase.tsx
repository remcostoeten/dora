'use client'

import { Braces, Play, Sparkles } from 'lucide-react'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'
import { useCycleIndex } from '@/components/feature-showcases/use-showcase-motion'

const DRIZZLE_CODE = `await db
  .select({
    name: customers.name,
    revenue: sum(orders.total).as('revenue'),
  })
  .from(customers)
  .innerJoin(orders, eq(orders.customerId, customers.id))
  .where(eq(orders.status, 'paid'))
  .groupBy(customers.name)
  .orderBy(desc(sum(orders.total)))
  .limit(5)`

const SQL_PREVIEW = `SELECT "customers"."name",
       sum("orders"."total") AS "revenue"
FROM "customers"
INNER JOIN "orders"
  ON "orders"."customer_id" = "customers"."id"
WHERE "orders"."status" = 'paid'
GROUP BY "customers"."name"
ORDER BY sum("orders"."total") DESC
LIMIT 5`

const SCHEMA_TABLES = [
    { name: 'customers', active: false },
    { name: 'orders', active: true },
    { name: 'products', active: false },
    { name: 'order_items', active: false }
]

const CHAIN_METHOD = /^\s*\.(select|from|innerJoin|where|groupBy|orderBy|limit)\b/

function highlightDrizzleLine(line: string) {
    if (line.trimStart().startsWith('await db')) {
        return (
            <>
                <span className="text-brand-300">await </span>
                <span className="text-foreground/90">db</span>
            </>
        )
    }

    if (CHAIN_METHOD.test(line)) {
        const match = line.match(/^(\s*)(\.\w+)/)
        if (!match) return <span className="text-foreground/85">{line}</span>
        return (
            <>
                <span>{match[1]}</span>
                <span className="text-brand-300">{match[2]}</span>
                <span className="text-foreground/85">{line.slice(match[0].length)}</span>
            </>
        )
    }

    return <span className="text-foreground/85">{line}</span>
}

export function DrizzleRunnerShowcase() {
    const lineCount = DRIZZLE_CODE.split('\n').length
    const activeLine = useCycleIndex(lineCount, 450)
    const revealLines = activeLine + 1

    return (
        <>
            <FeatureShowcaseRail demo="drizzle-runner" />
            <div className="grid min-w-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
                <aside className="flex flex-col border-r border-sidebar-border bg-sidebar">
                    <div className="border-b border-sidebar-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Schema
                    </div>
                    <div className="flex-1 py-1">
                        {SCHEMA_TABLES.map(function (table) {
                            return (
                                <div
                                    key={table.name}
                                    className={
                                        'px-3 py-1.5 font-mono text-xs ' +
                                        (table.active
                                            ? 'bg-sidebar-accent/50 text-foreground'
                                            : 'text-sidebar-foreground/80')
                                    }
                                >
                                    {table.name}
                                </div>
                            )
                        })}
                    </div>
                </aside>
                <div className="grid min-w-0 grid-rows-[minmax(0,1fr)_180px]">
                    <div className="flex min-h-0 flex-col border-b border-sidebar-border">
                        <div className="flex h-10 items-center gap-2 border-b border-sidebar-border px-3">
                            <span className="inline-flex items-center gap-1.5 rounded-[2px] bg-primary px-2.5 py-1 text-[11px] text-primary-foreground">
                                <Play className="h-3 w-3" />
                                Run
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-[2px] border border-sidebar-border px-2.5 py-1 text-[11px] text-muted-foreground">
                                <Braces className="h-3 w-3" />
                                JSON
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-brand-600">
                                <Sparkles className="h-3 w-3" />
                                Autocomplete active
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden p-3 font-mono text-[11px] leading-relaxed">
                            {DRIZZLE_CODE.split('\n').map(function (
                                line,
                                index
                            ) {
                                const visible = index < revealLines
                                return (
                                    <div
                                        key={index}
                                        className={
                                            'whitespace-pre transition-opacity duration-300 ' +
                                            (visible
                                                ? 'opacity-100'
                                                : 'opacity-0')
                                        }
                                    >
                                        <span className="mr-3 inline-block w-5 select-none text-right text-muted-foreground/40">
                                            {index + 1}
                                        </span>
                                        {highlightDrizzleLine(line)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex min-h-0 flex-col bg-surface-base">
                        <div className="border-b border-sidebar-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            SQL preview
                        </div>
                        <div className="flex-1 overflow-hidden p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
                            {SQL_PREVIEW.split('\n').map(function (line, index) {
                                return (
                                    <div key={index} className="whitespace-pre">
                                        {line}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
