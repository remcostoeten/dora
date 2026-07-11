'use client'

import { Loader2, Sparkles, X } from 'lucide-react'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'
import {
    useCycleIndex,
    useTypewriter
} from '@/components/feature-showcases/use-showcase-motion'

const GENERATED_SQL = `SELECT c.name, SUM(o.total) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.name
ORDER BY revenue DESC
LIMIT 5;`

export function AiAssistantShowcase() {
    const cycle = useCycleIndex(2, 8000)
    const typedSql = useTypewriter(GENERATED_SQL, 16, true, cycle)

    return (
        <>
            <FeatureShowcaseRail demo="ai-assistant" />
            <div className="relative flex min-w-0 flex-1 flex-col bg-background">
                <div className="flex h-10 items-center gap-3 border-b border-sidebar-border px-3 opacity-40">
                    <div className="rounded-[2px] border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1 text-[11px]">
                        Query 1
                    </div>
                    <div className="ml-auto rounded-[2px] bg-primary/20 px-2.5 py-1 text-[11px] text-primary">
                        Run
                    </div>
                </div>
                <div className="flex-1 p-4 font-mono text-[12px] text-muted-foreground/50">
                    -- SQL editor behind the assistant overlay
                </div>
                <div className="absolute inset-0 flex items-start justify-center bg-background/75 p-6 pt-12 backdrop-blur-[2px]">
                    <div className="w-full max-w-xl overflow-hidden rounded-lg border border-sidebar-border bg-popover shadow-2xl">
                        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
                            <Sparkles className="h-4 w-4 text-brand-600" />
                            <span className="text-sm font-medium text-foreground">
                                AI SQL assistant
                            </span>
                            <span className="ml-2 rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                                Demo E-Commerce schema
                            </span>
                            <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-[2px] text-muted-foreground">
                                <X className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="space-y-4 p-4">
                            <div>
                                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Prompt
                                </div>
                                <div className="rounded-[2px] border border-input bg-background px-3 py-2.5 text-sm text-foreground">
                                    top 5 customers by revenue from paid orders
                                </div>
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Generated SQL
                                    <Loader2 className="h-3 w-3 animate-spin text-brand-600" />
                                </div>
                                <div className="rounded-[2px] border border-sidebar-border bg-surface-deeper p-3 font-mono text-[11px] leading-relaxed">
                                    {typedSql.split('\n').map(function (
                                        line,
                                        index
                                    ) {
                                        return (
                                            <div key={index}>
                                                {line
                                                    .split(/(\b(?:SELECT|FROM|JOIN|ON|WHERE|GROUP BY|ORDER BY|DESC|LIMIT|AS)\b|'[^']*')/g)
                                                    .map(function (part, i) {
                                                        if (
                                                            /^(SELECT|FROM|JOIN|ON|WHERE|GROUP BY|ORDER BY|DESC|LIMIT|AS)$/.test(
                                                                part
                                                            )
                                                        ) {
                                                            return (
                                                                <span
                                                                    key={i}
                                                                    className="text-brand-300"
                                                                >
                                                                    {part}
                                                                </span>
                                                            )
                                                        }
                                                        if (
                                                            part.startsWith("'")
                                                        ) {
                                                            return (
                                                                <span
                                                                    key={i}
                                                                    className="text-brand-400"
                                                                >
                                                                    {part}
                                                                </span>
                                                            )
                                                        }
                                                        return (
                                                            <span
                                                                key={i}
                                                                className="text-foreground/85"
                                                            >
                                                                {part}
                                                            </span>
                                                        )
                                                    })}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                Uses live schema context from customers,
                                orders, and order_items. Review before running.
                            </p>
                            <div className="flex gap-2">
                                <span className="inline-flex flex-1 items-center justify-center rounded-[2px] bg-primary px-3 py-2 text-xs text-primary-foreground">
                                    Insert into editor
                                </span>
                                <span className="inline-flex items-center justify-center rounded-[2px] border border-sidebar-border px-3 py-2 text-xs text-foreground">
                                    Run query
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
