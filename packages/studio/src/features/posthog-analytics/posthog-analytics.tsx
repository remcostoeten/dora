import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { Activity, BarChart3, Globe, RefreshCw, TriangleAlert, Users } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { Skeleton } from '@studio/shared/ui/skeleton'
import { Switch } from '@studio/shared/ui/switch'
import { cn } from '@studio/shared/utils/cn'
import {
	activityQuery,
	kpiQuery,
	sitesQuery,
	toLabel,
	toNumber,
	topBrowsersQuery,
	topEventsQuery,
	topPagesQuery,
	type AnalyticsFilters
} from './queries'
import { useHogqlQuery } from './use-hogql-query'

type Props = {
	connectionId: string
	connectionName?: string
	windowControls?: ReactNode
}

const SERIES_COLORS = [
	'hsl(var(--primary))',
	'hsl(var(--chart-2, var(--accent-foreground)))',
	'hsl(var(--chart-3, 170 70% 45%))',
	'hsl(var(--chart-4, 35 90% 55%))',
	'hsl(var(--chart-5, 285 70% 60%))',
	'hsl(var(--muted-foreground))'
]

const TOOLTIP_STYLE = {
	background: 'hsl(var(--popover))',
	border: '1px solid hsl(var(--border))',
	color: 'hsl(var(--popover-foreground))',
	borderRadius: 8,
	fontSize: 12
}

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }

export function PosthogAnalytics({ connectionId, connectionName, windowControls }: Props) {
	const [refreshKey, setRefreshKey] = useState(0)
	const [excludeLocalhost, setExcludeLocalhost] = useState(false)

	const filters = useMemo<AnalyticsFilters>(
		function () {
			return { excludeLocalhost }
		},
		[excludeLocalhost]
	)

	const kpi = useHogqlQuery(connectionId, kpiQuery(filters), refreshKey)
	const sites = useHogqlQuery(connectionId, sitesQuery(filters), refreshKey)
	const activity = useHogqlQuery(connectionId, activityQuery(filters), refreshKey)
	const topEvents = useHogqlQuery(connectionId, topEventsQuery(filters), refreshKey)
	const topPages = useHogqlQuery(connectionId, topPagesQuery(filters), refreshKey)
	const topBrowsers = useHogqlQuery(connectionId, topBrowsersQuery(filters), refreshKey)

	const isRefreshing =
		kpi.isLoading ||
		sites.isLoading ||
		activity.isLoading ||
		topEvents.isLoading ||
		topPages.isLoading ||
		topBrowsers.isLoading

	const kpiRow = kpi.rows[0]
	const kpiEvents = cellNumber(kpiRow, kpi.columns, 0)
	const kpiUsers = cellNumber(kpiRow, kpi.columns, 1)
	const kpiPageviews = cellNumber(kpiRow, kpi.columns, 2)
	const sitesData = useMemo(
		function () {
			return sites.rows.map(function (row) {
				return {
					site: cellLabel(row, sites.columns, 0, '(unknown)'),
					events: cellNumber(row, sites.columns, 1),
					users: cellNumber(row, sites.columns, 2),
					pageviews: cellNumber(row, sites.columns, 3),
					lastSeen: cellLabel(row, sites.columns, 4, '')
				}
			})
		},
		[sites.rows, sites.columns]
	)
	const activityData = useMemo(
		function () {
			return activity.rows.map(function (row) {
				return {
					day: cellLabel(row, activity.columns, 0, ''),
					events: cellNumber(row, activity.columns, 1),
					users: cellNumber(row, activity.columns, 2)
				}
			})
		},
		[activity.rows, activity.columns]
	)
	const topEventsData = useMemo(
		function () {
			return topEvents.rows.map(function (row) {
				return {
					label: cellLabel(row, topEvents.columns, 0, '(unknown)'),
					value: cellNumber(row, topEvents.columns, 1)
				}
			})
		},
		[topEvents.rows, topEvents.columns]
	)
	const topPagesData = useMemo(
		function () {
			return topPages.rows.map(function (row) {
				return {
					label: shortenUrl(cellLabel(row, topPages.columns, 0, '(direct)')),
					value: cellNumber(row, topPages.columns, 1)
				}
			})
		},
		[topPages.rows, topPages.columns]
	)
	const topBrowsersData = useMemo(
		function () {
			return topBrowsers.rows.map(function (row) {
				return {
					label: cellLabel(row, topBrowsers.columns, 0, '(unknown)'),
					value: cellNumber(row, topBrowsers.columns, 1)
				}
			})
		},
		[topBrowsers.rows, topBrowsers.columns]
	)

	return (
		<div className='flex h-full min-h-0 flex-col bg-background'>
			<header className='flex shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar-accent/10 px-4 py-2.5'>
				<div className='flex min-w-0 items-center gap-2'>
					<BarChart3 className='h-4 w-4 text-primary' />
					<span className='truncate text-sm font-medium text-sidebar-foreground'>
						Analytics
					</span>
					{connectionName && (
						<span className='truncate text-xs text-muted-foreground'>· {connectionName}</span>
					)}
				</div>
				<span className='hidden text-[11px] uppercase tracking-wide text-muted-foreground sm:inline'>
					Last 7–14 days
				</span>
				<div className='ml-auto flex items-center gap-3'>
					<label className='flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground'>
						<Switch
							checked={excludeLocalhost}
							onCheckedChange={setExcludeLocalhost}
							aria-label='Exclude localhost traffic'
						/>
						Exclude localhost
					</label>
					<Button
						variant='ghost'
						size='sm'
						className='h-7 gap-1.5 px-2 text-xs'
						onClick={() => setRefreshKey((key) => key + 1)}
						disabled={isRefreshing}
					>
						<RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
						Refresh
					</Button>
					{windowControls}
				</div>
			</header>

			<div className='min-h-0 flex-1 overflow-y-auto p-4'>
				<div className='mx-auto flex max-w-6xl flex-col gap-4'>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
						<StatTile
							icon={<Activity className='h-4 w-4' />}
							label='Events'
							value={kpiRow ? kpiEvents : null}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
						<StatTile
							icon={<Users className='h-4 w-4' />}
							label='Unique users'
							value={kpiRow ? kpiUsers : null}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
						<StatTile
							icon={<BarChart3 className='h-4 w-4' />}
							label='Pageviews'
							value={kpiRow ? kpiPageviews : null}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
					</div>

					<SitesCard
						sites={sitesData}
						isLoading={sites.isLoading}
						error={sites.error}
					/>

					<ChartCard
						title='Activity — last 14 days'
						isLoading={activity.isLoading}
						error={activity.error}
						isEmpty={activityData.length === 0}
						className='h-[280px]'
					>
						<ResponsiveContainer width='100%' height='100%'>
							<AreaChart data={activityData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
								<defs>
									<linearGradient id='ph-events' x1='0' y1='0' x2='0' y2='1'>
										<stop offset='5%' stopColor={SERIES_COLORS[0]} stopOpacity={0.35} />
										<stop offset='95%' stopColor={SERIES_COLORS[0]} stopOpacity={0} />
									</linearGradient>
									<linearGradient id='ph-users' x1='0' y1='0' x2='0' y2='1'>
										<stop offset='5%' stopColor={SERIES_COLORS[2]} stopOpacity={0.35} />
										<stop offset='95%' stopColor={SERIES_COLORS[2]} stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid stroke='hsl(var(--border))' strokeDasharray='3 3' vertical={false} />
								<XAxis dataKey='day' tick={AXIS_TICK} tickFormatter={formatDayTick} />
								<YAxis tick={AXIS_TICK} width={44} tickFormatter={formatCompact} />
								<Tooltip contentStyle={TOOLTIP_STYLE} />
								<Legend wrapperStyle={{ fontSize: 12 }} />
								<Area
									type='monotone'
									dataKey='events'
									name='Events'
									stroke={SERIES_COLORS[0]}
									fill='url(#ph-events)'
									strokeWidth={2}
									isAnimationActive={false}
								/>
								<Area
									type='monotone'
									dataKey='users'
									name='Users'
									stroke={SERIES_COLORS[2]}
									fill='url(#ph-users)'
									strokeWidth={2}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</ChartCard>

					<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
						<ChartCard
							title='Top events — last 7 days'
							isLoading={topEvents.isLoading}
							error={topEvents.error}
							isEmpty={topEventsData.length === 0}
							className='h-[320px]'
						>
							<ResponsiveContainer width='100%' height='100%'>
								<BarChart
									data={topEventsData}
									layout='vertical'
									margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
								>
									<CartesianGrid stroke='hsl(var(--border))' strokeDasharray='3 3' horizontal={false} />
									<XAxis type='number' tick={AXIS_TICK} tickFormatter={formatCompact} />
									<YAxis
										type='category'
										dataKey='label'
										tick={AXIS_TICK}
										width={140}
										interval={0}
									/>
									<Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.35)' }} />
									<Bar dataKey='value' name='Count' fill={SERIES_COLORS[0]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
								</BarChart>
							</ResponsiveContainer>
						</ChartCard>

						<ChartCard
							title='Top browsers — last 7 days'
							isLoading={topBrowsers.isLoading}
							error={topBrowsers.error}
							isEmpty={topBrowsersData.length === 0}
							className='h-[320px]'
						>
							<ResponsiveContainer width='100%' height='100%'>
								<PieChart>
									<Tooltip contentStyle={TOOLTIP_STYLE} />
									<Legend wrapperStyle={{ fontSize: 12 }} />
									<Pie
										data={topBrowsersData}
										dataKey='value'
										nameKey='label'
										innerRadius='45%'
										outerRadius='78%'
										paddingAngle={1}
										isAnimationActive={false}
									>
										{topBrowsersData.map(function (_entry, index) {
											return <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
										})}
									</Pie>
								</PieChart>
							</ResponsiveContainer>
						</ChartCard>
					</div>

					<ChartCard
						title='Top pages — last 7 days'
						isLoading={topPages.isLoading}
						error={topPages.error}
						isEmpty={topPagesData.length === 0}
						className='h-[320px]'
					>
						<ResponsiveContainer width='100%' height='100%'>
							<BarChart
								data={topPagesData}
								layout='vertical'
								margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
							>
								<CartesianGrid stroke='hsl(var(--border))' strokeDasharray='3 3' horizontal={false} />
								<XAxis type='number' tick={AXIS_TICK} tickFormatter={formatCompact} />
								<YAxis type='category' dataKey='label' tick={AXIS_TICK} width={220} interval={0} />
								<Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.35)' }} />
								<Bar dataKey='value' name='Views' fill={SERIES_COLORS[2]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
							</BarChart>
						</ResponsiveContainer>
					</ChartCard>
				</div>
			</div>
		</div>
	)
}

type SiteRow = {
	site: string
	events: number
	users: number
	pageviews: number
	lastSeen: string
}

function SitesCard({
	sites,
	isLoading,
	error
}: {
	sites: SiteRow[]
	isLoading: boolean
	error: string | null
}) {
	return (
		<div className='rounded-lg border border-sidebar-border bg-background'>
			<div className='flex items-center gap-2 border-b border-sidebar-border px-4 py-2.5 text-xs font-medium text-sidebar-foreground'>
				<Globe className='h-4 w-4 text-primary' />
				Monitored sites
				<span className='text-muted-foreground'>· last 30 days</span>
				{!isLoading && !error && (
					<span className='ml-auto rounded-full bg-sidebar-accent/40 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground'>
						{sites.length}
					</span>
				)}
			</div>
			<div className='p-3'>
				{isLoading ? (
					<div className='space-y-2'>
						<Skeleton className='h-8 w-full' />
						<Skeleton className='h-8 w-full' />
						<Skeleton className='h-8 w-2/3' />
					</div>
				) : error ? (
					<CardMessage icon={<TriangleAlert className='h-6 w-6 text-amber-500' />} text={error} />
				) : sites.length === 0 ? (
					<CardMessage
						icon={<Globe className='h-6 w-6 text-muted-foreground' />}
						text='No hostnames found. This project may not capture the $host property (e.g. non-web events).'
					/>
				) : (
					<div className='overflow-hidden rounded-md border border-sidebar-border'>
						<table className='w-full text-left text-xs'>
							<thead className='bg-sidebar-accent/20 text-[11px] uppercase tracking-wide text-muted-foreground'>
								<tr>
									<th className='px-3 py-2 font-medium'>Site</th>
									<th className='px-3 py-2 text-right font-medium'>Events</th>
									<th className='px-3 py-2 text-right font-medium'>Users</th>
									<th className='px-3 py-2 text-right font-medium'>Pageviews</th>
									<th className='hidden px-3 py-2 text-right font-medium sm:table-cell'>Last event</th>
								</tr>
							</thead>
							<tbody>
								{sites.map(function (row) {
									return (
										<tr
											key={row.site}
											className='border-t border-sidebar-border/60 hover:bg-sidebar-accent/10'
										>
											<td className='max-w-0 px-3 py-2'>
												<div className='flex items-center gap-2'>
													<span
														className='h-1.5 w-1.5 shrink-0 rounded-full bg-primary'
														aria-hidden
													/>
													<span className='truncate font-medium text-sidebar-foreground'>
														{row.site}
													</span>
												</div>
											</td>
											<td className='px-3 py-2 text-right tabular-nums text-sidebar-foreground'>
												{row.events.toLocaleString()}
											</td>
											<td className='px-3 py-2 text-right tabular-nums text-muted-foreground'>
												{row.users.toLocaleString()}
											</td>
											<td className='px-3 py-2 text-right tabular-nums text-muted-foreground'>
												{row.pageviews.toLocaleString()}
											</td>
											<td className='hidden px-3 py-2 text-right text-muted-foreground sm:table-cell'>
												{formatRelative(row.lastSeen)}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}

function StatTile({
	icon,
	label,
	value,
	isLoading,
	error
}: {
	icon: ReactNode
	label: string
	value: number | null
	isLoading: boolean
	error: string | null
}) {
	return (
		<div className='rounded-lg border border-sidebar-border bg-sidebar-accent/10 p-4'>
			<div className='flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
				<span className='text-primary'>{icon}</span>
				{label}
			</div>
			<div className='mt-2 text-2xl font-semibold tabular-nums text-sidebar-foreground'>
				{isLoading ? (
					<Skeleton className='h-7 w-24' />
				) : error ? (
					<span className='text-sm font-normal text-muted-foreground'>—</span>
				) : (
					(value ?? 0).toLocaleString()
				)}
			</div>
		</div>
	)
}

function ChartCard({
	title,
	isLoading,
	error,
	isEmpty,
	className,
	children
}: {
	title: string
	isLoading: boolean
	error: string | null
	isEmpty: boolean
	className?: string
	children: ReactNode
}) {
	return (
		<div className='rounded-lg border border-sidebar-border bg-background'>
			<div className='border-b border-sidebar-border px-4 py-2.5 text-xs font-medium text-sidebar-foreground'>
				{title}
			</div>
			<div className={cn('p-3', className)}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center'>
						<Skeleton className='h-full w-full rounded-md' />
					</div>
				) : error ? (
					<CardMessage icon={<TriangleAlert className='h-6 w-6 text-amber-500' />} text={error} />
				) : isEmpty ? (
					<CardMessage
						icon={<BarChart3 className='h-6 w-6 text-muted-foreground' />}
						text='No data in this time range.'
					/>
				) : (
					children
				)}
			</div>
		</div>
	)
}

function CardMessage({ icon, text }: { icon: ReactNode; text: string }) {
	return (
		<div className='flex h-full flex-col items-center justify-center gap-2 text-center'>
			{icon}
			<span className='max-w-md text-xs text-muted-foreground'>{text}</span>
		</div>
	)
}

/** Compacts large axis/tooltip numbers (12500 → 12.5K, 3_400_000 → 3.4M). */
function formatCompact(value: number): string {
	if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
	if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
	return String(value)
}

/**
 * Reads a cell by its column position rather than by name. PostHog/HogQL doesn't
 * guarantee the response's column names match our SELECT aliases (grouped and
 * aggregate queries can come back with synthesized `column_N` keys), so the
 * dashboard binds to the ordered `columns` list the adapter returns instead.
 */
function cellAt(
	row: Record<string, unknown> | undefined,
	columns: string[],
	index: number
): unknown {
	if (!row) return undefined
	const key = columns[index]
	return key === undefined ? undefined : row[key]
}

function cellNumber(
	row: Record<string, unknown> | undefined,
	columns: string[],
	index: number
): number {
	return toNumber(cellAt(row, columns, index))
}

function cellLabel(
	row: Record<string, unknown> | undefined,
	columns: string[],
	index: number,
	fallback: string
): string {
	return toLabel(cellAt(row, columns, index), fallback)
}

/** Renders a HogQL timestamp as a coarse "time ago" label for the sites table. */
function formatRelative(value: string): string {
	if (!value) return '—'
	const normalized = value.includes('T') ? value : value.replace(' ', 'T')
	const then = new Date(normalized).getTime()
	if (Number.isNaN(then)) return value
	const minutes = Math.round((Date.now() - then) / 60_000)
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.round(hours / 24)
	return `${days}d ago`
}

/** Shows the month/day tail of a `YYYY-MM-DD` HogQL date for a tidy axis. */
function formatDayTick(value: string): string {
	const parts = value.split('-')
	return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value
}

/** Trims a URL to host + path so page labels stay readable on the axis. */
function shortenUrl(url: string): string {
	try {
		const parsed = new URL(url)
		const path = parsed.pathname === '/' ? '' : parsed.pathname
		const short = `${parsed.host}${path}`
		return short.length > 42 ? `${short.slice(0, 41)}…` : short
	} catch {
		return url.length > 42 ? `${url.slice(0, 41)}…` : url
	}
}
