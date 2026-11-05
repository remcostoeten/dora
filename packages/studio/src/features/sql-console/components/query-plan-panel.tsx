import { useMemo } from 'react'
import { Copy, Network } from 'lucide-react'

import { Button } from '@studio/shared/ui/button'
import { ScrollArea } from '@studio/shared/ui/scroll-area'
import { cn } from '@studio/shared/utils/cn'
import type { SqlQueryResult } from '../types'

type Props = {
	result: SqlQueryResult
}

type PlanNode = {
	label: string
	detail?: string
	cost?: number
	rows?: number
	width?: number
	actualTime?: number
	actualRows?: number
	loops?: number
	children: PlanNode[]
}

type ParsedPlan = {
	root: PlanNode | null
	/** Flat text rendering used as a fallback (MySQL, unknown formats). */
	text: string | null
	maxCost: number
}

/**
 * Detects whether the executed statement was an EXPLAIN / EXPLAIN ANALYZE so the
 * results area can route it to the dedicated plan view instead of the grid.
 */
export function isExplainQuery(query: string | undefined | null): boolean {
	if (!query) return false
	return /^\s*explain\b/i.test(query)
}

/**
 * Best-effort parser that handles the three shapes Dora can produce:
 * - Postgres `EXPLAIN (FORMAT JSON)` -> a single JSON column with a `Plan` tree.
 * - SQLite `EXPLAIN QUERY PLAN` -> rows of { id, parent, detail }.
 * - Anything else (MySQL, raw text) -> concatenated cell text.
 */
function parsePlan(result: SqlQueryResult): ParsedPlan {
	// --- Postgres: FORMAT JSON ---
	const pgPlan = tryParsePostgresJson(result)
	if (pgPlan) {
		return { root: pgPlan, text: null, maxCost: maxCostOf(pgPlan) }
	}

	// --- SQLite: EXPLAIN QUERY PLAN ---
	const sqlitePlan = tryParseSqliteQueryPlan(result)
	if (sqlitePlan) {
		return { root: sqlitePlan, text: null, maxCost: 0 }
	}

	// --- Fallback: render every cell as indented text ---
	const lines: string[] = []
	for (const row of result.rows) {
		for (const col of result.columns) {
			const value = row[col]
			if (value === null || value === undefined) continue
			lines.push(String(value))
		}
	}
	return { root: null, text: lines.join('\n') || 'No plan output.', maxCost: 0 }
}

function tryParsePostgresJson(result: SqlQueryResult): PlanNode | null {
	if (result.rows.length === 0) return null
	const firstRow = result.rows[0]

	// The JSON plan can arrive as a real object/array or as a JSON string.
	let candidate: unknown = null
	for (const col of result.columns) {
		const value = firstRow[col]
		if (value == null) continue
		if (typeof value === 'object') {
			candidate = value
			break
		}
		if (typeof value === 'string') {
			const trimmed = value.trim()
			if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
				try {
					candidate = JSON.parse(trimmed)
					break
				} catch {
					// not JSON, keep scanning
				}
			}
		}
	}

	if (candidate == null) return null

	// Postgres wraps the plan as: [{ "Plan": { ... } }]
	const wrapper = Array.isArray(candidate) ? candidate[0] : candidate
	if (!wrapper || typeof wrapper !== 'object') return null
	const planObj = (wrapper as Record<string, unknown>).Plan ?? wrapper
	if (!planObj || typeof planObj !== 'object') return null
	if (!('Node Type' in (planObj as Record<string, unknown>))) return null

	return convertPostgresNode(planObj as Record<string, unknown>)
}

function convertPostgresNode(node: Record<string, unknown>): PlanNode {
	const nodeType = String(node['Node Type'] ?? 'Node')
	const relation = node['Relation Name']
	const indexName = node['Index Name']
	const labelParts = [nodeType]
	if (typeof indexName === 'string') labelParts.push(`using ${indexName}`)
	else if (typeof relation === 'string') labelParts.push(`on ${relation}`)

	const childrenRaw = node['Plans']
	const children = Array.isArray(childrenRaw)
		? childrenRaw.map(function (child) {
				return convertPostgresNode(child as Record<string, unknown>)
			})
		: []

	return {
		label: labelParts.join(' '),
		cost: numberOrUndefined(node['Total Cost']),
		rows: numberOrUndefined(node['Plan Rows']),
		width: numberOrUndefined(node['Plan Width']),
		actualTime: numberOrUndefined(node['Actual Total Time']),
		actualRows: numberOrUndefined(node['Actual Rows']),
		loops: numberOrUndefined(node['Actual Loops']),
		children
	}
}

function tryParseSqliteQueryPlan(result: SqlQueryResult): PlanNode | null {
	const cols = result.columns.map(function (c) {
		return c.toLowerCase()
	})
	const hasDetail = cols.includes('detail')
	const hasId = cols.includes('id')
	const hasParent = cols.includes('parent')
	if (!hasDetail || !hasId || !hasParent) return null

	const idCol = result.columns[cols.indexOf('id')]
	const parentCol = result.columns[cols.indexOf('parent')]
	const detailCol = result.columns[cols.indexOf('detail')]

	const nodesById = new Map<number, PlanNode>()
	const childrenByParent = new Map<number, PlanNode[]>()

	for (const row of result.rows) {
		const id = Number(row[idCol])
		const parent = Number(row[parentCol])
		const node: PlanNode = {
			label: String(row[detailCol] ?? ''),
			children: []
		}
		nodesById.set(id, node)
		const siblings = childrenByParent.get(parent) ?? []
		siblings.push(node)
		childrenByParent.set(parent, siblings)
	}

	for (const [id, node] of nodesById) {
		node.children = childrenByParent.get(id) ?? []
	}

	const roots = childrenByParent.get(0) ?? []
	if (roots.length === 0) return null
	if (roots.length === 1) return roots[0]
	return { label: 'QUERY PLAN', children: roots }
}

function numberOrUndefined(value: unknown): number | undefined {
	const n = Number(value)
	return Number.isFinite(n) ? n : undefined
}

function maxCostOf(node: PlanNode): number {
	let max = node.cost ?? 0
	for (const child of node.children) {
		max = Math.max(max, maxCostOf(child))
	}
	return max
}

/** Maps a node cost onto a green -> amber -> red scale relative to the plan max. */
function costColorClass(cost: number | undefined, maxCost: number): string {
	if (cost === undefined || maxCost <= 0) return 'border-l-sidebar-border'
	const ratio = cost / maxCost
	if (ratio < 0.25) return 'border-l-emerald-500'
	if (ratio < 0.5) return 'border-l-lime-500'
	if (ratio < 0.75) return 'border-l-amber-500'
	return 'border-l-red-500'
}

function PlanTreeNode({
	node,
	depth,
	maxCost
}: {
	node: PlanNode
	depth: number
	maxCost: number
}) {
	const hasMetrics =
		node.cost !== undefined || node.rows !== undefined || node.actualTime !== undefined

	return (
		<div>
			<div
				className={cn('border-l-2 py-1 pr-2', costColorClass(node.cost, maxCost))}
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
			>
				<div className='font-mono text-xs text-sidebar-foreground'>{node.label}</div>
				{hasMetrics && (
					<div className='mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground'>
						{node.cost !== undefined && <span>cost={node.cost.toLocaleString()}</span>}
						{node.rows !== undefined && <span>rows={node.rows.toLocaleString()}</span>}
						{node.width !== undefined && <span>width={node.width}</span>}
						{node.actualTime !== undefined && (
							<span className='text-amber-600 dark:text-amber-400'>
								actual time={node.actualTime}ms
							</span>
						)}
						{node.actualRows !== undefined && (
							<span className='text-amber-600 dark:text-amber-400'>
								actual rows={node.actualRows.toLocaleString()}
							</span>
						)}
						{node.loops !== undefined && <span>loops={node.loops}</span>}
					</div>
				)}
			</div>
			{node.children.map(function (child, index) {
				return <PlanTreeNode key={index} node={child} depth={depth + 1} maxCost={maxCost} />
			})}
		</div>
	)
}

export function QueryPlanPanel({ result }: Props) {
	const plan = useMemo(
		function () {
			return parsePlan(result)
		},
		[result]
	)

	function handleCopy() {
		const text = plan.text ?? JSON.stringify(result.rows, null, 2)
		navigator.clipboard.writeText(text)
	}

	return (
		<div className='flex h-full flex-col bg-background'>
			<div className='flex h-8 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar-accent/30 px-2'>
				<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
					<Network className='h-3.5 w-3.5' />
					<span className='font-medium text-sidebar-foreground'>Query plan</span>
					<span className='text-[11px]'>{result.executionTime}ms</span>
				</div>
				<Button
					variant='ghost'
					size='icon'
					className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
					onClick={handleCopy}
					title='Copy plan'
				>
					<Copy className='h-3.5 w-3.5' />
				</Button>
			</div>

			<ScrollArea className='flex-1'>
				{plan.root ? (
					<div className='py-2'>
						<PlanTreeNode node={plan.root} depth={0} maxCost={plan.maxCost} />
					</div>
				) : (
					<pre className='whitespace-pre-wrap p-3 font-mono text-xs text-sidebar-foreground'>
						{plan.text}
					</pre>
				)}
			</ScrollArea>
		</div>
	)
}
