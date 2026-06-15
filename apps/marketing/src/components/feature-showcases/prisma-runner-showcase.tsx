'use client'

import { Braces, Play, Sparkles } from 'lucide-react'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'
import { useCycleIndex } from '@/components/feature-showcases/use-showcase-motion'

const PRISMA_CODE = `prisma.customer.findMany({
  where: { orders: { some: { status: 'paid' } } },
  select: {
    name: true,
    _count: { select: { orders: true } },
  },
  orderBy: { orders: { _count: 'desc' } },
  take: 5,
})`

const SQL_PREVIEW = `SELECT "customers"."name",
       count("orders"."id") AS "orders_count"
FROM "customers"
INNER JOIN "orders"
  ON "orders"."customer_id" = "customers"."id"
WHERE "orders"."status" = 'paid'
GROUP BY "customers"."name"
ORDER BY count("orders"."id") DESC
LIMIT 5`

const SCHEMA_MODELS = [
    { name: 'Customer', active: true },
    { name: 'Order', active: false },
    { name: 'Product', active: false },
    { name: 'OrderItem', active: false }
]

const PRISMA_ROOT = /^\s*prisma\.\w+\.\w+\(/
const PRISMA_KEY = /^(\s*)(\w+):/

function highlightPrismaLine(line: string) {
    if (PRISMA_ROOT.test(line)) {
        const match = line.match(/^(\s*)(prisma)\.(\w+)\.(\w+)(\()/)
        if (match) {
            return (
                <>
                    <span>{match[1]}</span>
                    <span className="text-foreground/90">{match[2]}</span>
                    <span className="text-foreground/60">.</span>
                    <span className="text-[#ad8eb6]">{match[3]}</span>
                    <span className="text-foreground/60">.</span>
                    <span className="text-[#e3b2b3]">{match[4]}</span>
                    <span className="text-foreground/85">{line.slice(match[0].length - 1)}</span>
                </>
            )
        }
    }

    const keyMatch = line.match(PRISMA_KEY)
    if (keyMatch) {
        return (
            <>
                <span>{keyMatch[1]}</span>
                <span className="text-[#9ec6e0]">{keyMatch[2]}</span>
                <span className="text-foreground/85">{line.slice(keyMatch[0].length - 1)}</span>
            </>
        )
    }

    return <span className="text-foreground/85">{line}</span>
}

export function PrismaRunnerShowcase() {
    const lineCount = PRISMA_CODE.split('\n').length
    const activeLine = useCycleIndex(lineCount, 450)
    const revealLines = activeLine + 1

    return (
        <>
            <FeatureShowcaseRail demo="prisma-runner" />
            <div className="grid min-w-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
                <aside className="flex flex-col border-r border-sidebar-border bg-sidebar">
                    <div className="border-b border-sidebar-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Models
                    </div>
                    <div className="flex-1 py-1">
                        {SCHEMA_MODELS.map(function (model) {
                            return (
                                <div
                                    key={model.name}
                                    className={
                                        'px-3 py-1.5 font-mono text-xs ' +
                                        (model.active
                                            ? 'bg-sidebar-accent/50 text-foreground'
                                            : 'text-sidebar-foreground/80')
                                    }
                                >
                                    {model.name}
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
                                Prisma
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#ad8eb6]">
                                <Sparkles className="h-3 w-3" />
                                Translated to SQL
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden p-3 font-mono text-[11px] leading-relaxed">
                            {PRISMA_CODE.split('\n').map(function (line, index) {
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
                                        {highlightPrismaLine(line)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex min-h-0 flex-col bg-[#0a0a0a]">
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
