import { useCallback, useMemo, useState } from 'react'
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
import {
	Activity,
	BarChart3,
	Globe,
	MousePointerClick,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	TriangleAlert,
	Users,
	X
} from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { Skeleton } from '@studio/shared/ui/skeleton'
import { Switch } from '@studio/shared/ui/switch'
import { cn } from '@studio/shared/utils/cn'
import {
	activityQuery,
	DAY_RANGES,
	DRILL_LABELS,
	kpiQuery,
	percentChange,
	sitesQuery,
	toLabel,
	toNumber,
	topBrowsersQuery,
	topCountriesQuery,
	topDevicesQuery,
	topEventsQuery,
	topPagesQuery,
	topReferrersQuery,
	type AnalyticsFilters,
	type DrillKey
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

/** One row of a "top values of a property" panel. */
type BreakdownDatum = {
	/** The raw property value, used when drilling. */
	value: string
	/** The display form (URLs are shortened for the axis). */
	label: string
	count: number
	users: number
}

export function PosthogAnalytics({ connectionId, connectionName, windowControls }: Props) {
	const [refreshKey, setRefreshKey] = useState(0)
	const [excludeLocalhost, setExcludeLocalhost] = useState(false)
	const [days, setDays] = useState<number>(7)
	const [drills, setDrills] = useState<Partial<Record<DrillKey, string>>>({})

	const filters = useMemo<AnalyticsFilters>(
		function () {
			return { excludeLocalhost, days, drills }
		},
		[excludeLocalhost, days, drills]
	)

	const drill = useCallback((key: DrillKey, value: string) => {
		setDrills((current) => ({ ...current, [key]: value }))
	}, [])

	const clearDrill = useCallback((key: DrillKey) => {
		setDrills((current) => {
			const next = { ...current }
			delete next[key]
			return next
		})
	}, [])

	const kpi = useHogqlQuery(connectionId, kpiQuery(filters), refreshKey)
	const sites = useHogqlQuery(connectionId, sitesQuery(filters), refreshKey)
	const activity = useHogqlQuery(connectionId, activityQuery(filters), refreshKey)
	const topEvents = useHogqlQuery(connectionId, topEventsQuery(filters), refreshKey)
	const topPages = useHogqlQuery(connectionId, topPagesQuery(filters), refreshKey)
	const topBrowsers = useHogqlQuery(connectionId, topBrowsersQuery(filters), refreshKey)
	const topReferrers = useHogqlQuery(connectionId, topReferrersQuery(filters), refreshKey)
	const topCountries = useHogqlQuery(connectionId, topCountriesQuery(filters), refreshKey)
	const topDevices = useHogqlQuery(connectionId, topDevicesQuery(filters), refreshKey)

	const isRefreshing =
		kpi.isLoading ||
		sites.isLoading ||
		activity.isLoading ||
		topEvents.isLoading ||
		topPages.isLoading ||
		topBrowsers.isLoading ||
		topReferrers.isLoading ||
		topCountries.isLoading ||
		topDevices.isLoading

	const kpiRow = kpi.rows[0]
	const sitesData = useMemo(
		function () {
			return sites.rows.map((row) => ({
				site: cellLabel(row, sites.columns, 0, '(unknown)'),
				events: cellNumber(row, sites.columns, 1),
				users: cellNumber(row, sites.columns, 2),
				pageviews: cellNumber(row, sites.columns, 3),
				lastSeen: cellLabel(row, sites.columns, 4, '')
			}))
		},
		[sites.rows, sites.columns]
	)
	const activityData = useMemo(
		function () {
			return activity.rows.map((row) => ({
				day: cellLabel(row, activity.columns, 0, ''),
				events: cellNumber(row, activity.columns, 1),
				users: cellNumber(row, activity.columns, 2)
			}))
		},
		[activity.rows, activity.columns]
	)

	const topEventsData = useBreakdown(topEvents, '(unknown)')
	const topPagesData = useBreakdown(topPages, '(direct)', shortenUrl)
	const topBrowsersData = useBreakdown(topBrowsers, '(unknown)')
	const topReferrersData = useBreakdown(topReferrers, '(direct)')
	const topCountriesData = useBreakdown(topCountries, '(unknown)')
	const topDevicesData = useBreakdown(topDevices, '(unknown)')

	const activeDrills = Object.entries(drills).filter(([, value]) => Boolean(value)) as [
		DrillKey,
		string
	][]

	return (
		<div className='flex h-full min-h-0 flex-col bg-background'>
			<header className='flex shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar-accent/10 px-4 py-2.5'>
				<div className='flex min-w-0 items-center gap-2'>
					<BarChart3 className='h-4 w-4 text-primary' />
					<span className='truncate text-sm font-medium text-sidebar-foreground'>Analytics</span>
					{connectionName && (
						<span className='truncate text-xs text-muted-foreground'>· {connectionName}</span>
					)}
				</div>

				<div className='ml-2 flex items-center rounded-md border border-sidebar-border p-0.5'>
					{DAY_RANGES.map((range) => (
						<button
							key={range}
							type='button'
							onClick={() => setDays(range)}
							className={cn(
								'rounded px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
								days === range
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:text-sidebar-foreground'
							)}
						>
							{range}d
						</button>
					))}
				</div>

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
					{activeDrills.length > 0 && (
						<div className='flex flex-wrap items-center gap-2'>
							<span className='text-[11px] uppercase tracking-wide text-muted-foreground'>
								Filtered by
							</span>
							{activeDrills.map(([key, value]) => (
								<button
									key={key}
									type='button'
									onClick={() => clearDrill(key)}
									className='group flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/20 py-0.5 pl-2.5 pr-1.5 text-xs text-sidebar-foreground hover:border-primary/50'
								>
									<span className='text-muted-foreground'>{DRILL_LABELS[key]}</span>
									<span className='max-w-[220px] truncate font-medium'>{value}</span>
									<X className='h-3 w-3 text-muted-foreground group-hover:text-sidebar-foreground' />
								</button>
							))}
							<button
								type='button'
								onClick={() => setDrills({})}
								className='text-xs text-muted-foreground underline-offset-2 hover:underline'
							>
								Clear all
							</button>
						</div>
					)}

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
						<StatTile
							icon={<Activity className='h-4 w-4' />}
							label='Events'
							value={kpiRow ? cellNumber(kpiRow, kpi.columns, 0) : null}
							previous={kpiRow ? cellNumber(kpiRow, kpi.columns, 4) : null}
							days={days}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
						<StatTile
							icon={<Users className='h-4 w-4' />}
							label='Unique users'
							value={kpiRow ? cellNumber(kpiRow, kpi.columns, 1) : null}
							previous={kpiRow ? cellNumber(kpiRow, kpi.columns, 5) : null}
							days={days}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
						<StatTile
							icon={<BarChart3 className='h-4 w-4' />}
							label='Pageviews'
							value={kpiRow ? cellNumber(kpiRow, kpi.columns, 2) : null}
							previous={kpiRow ? cellNumber(kpiRow, kpi.columns, 6) : null}
							days={days}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
						<StatTile
							icon={<MousePointerClick className='h-4 w-4' />}
							label='Sessions'
							value={kpiRow ? cellNumber(kpiRow, kpi.columns, 3) : null}
							previous={kpiRow ? cellNumber(kpiRow, kpi.columns, 7) : null}
							days={days}
							isLoading={kpi.isLoading}
							error={kpi.error}
						/>
					</div>

					<SitesCard
						sites={sitesData}
						days={days}
						isLoading={sites.isLoading}
						error={sites.error}
						activeSite={drills.site}
						onDrill={(site) => drill('site', site)}
					/>

					<ChartCard
						title={`Activity — last ${days} days`}
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
						<BreakdownBarCard
							title={`Top events — last ${days} days`}
							data={topEventsData}
							state={topEvents}
							color={SERIES_COLORS[0]}
							labelWidth={140}
							onDrill={(value) => drill('event', value)}
						/>
						<DonutCard
							title={`Top browsers — last ${days} days`}
							data={topBrowsersData}
							state={topBrowsers}
							onDrill={(value) => drill('browser', value)}
						/>
					</div>

					<BreakdownBarCard
						title={`Top pages — last ${days} days`}
						data={topPagesData}
						state={topPages}
						color={SERIES_COLORS[2]}
						labelWidth={220}
						onDrill={(value) => drill('path', value)}
					/>

					<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
						<BreakdownBarCard
							title={`Top referrers — last ${days} days`}
							data={topReferrersData}
							state={topReferrers}
							color={SERIES_COLORS[3]}
							labelWidth={160}
							onDrill={(value) => drill('referrer', value)}
						/>
						<BreakdownBarCard
							title={`Top countries — last ${days} days`}
							data={topCountriesData}
							state={topCountries}
							color={SERIES_COLORS[4]}
							labelWidth={160}
							onDrill={(value) => drill('country', value)}
						/>
					</div>

					<DonutCard
						title={`Devices — last ${days} days`}
						data={topDevicesData}
						state={topDevices}
						onDrill={(value) => drill('device', value)}
					/>
				</div>
			</div>
		</div>
	)
}

type QueryState = {
	rows: Record<string, unknown>[]
	columns: string[]
	isLoading: boolean
	error: string | null
}

/**
 * Shapes a breakdown result (`label, count, users`) into chart data, keeping the
 * raw property value alongside the display label so a click can drill on the
 * real value rather than the shortened one.
 */
function useBreakdown(
	state: QueryState,
	fallback: string,
	format?: (value: string) => string
): BreakdownDatum[] {
	return useMemo(
		function () {
			return state.rows.map((row) => {
				const value = cellLabel(row, state.columns, 0, fallback)
				return {
					value,
					label: format ? format(value) : value,
					count: cellNumber(row, state.columns, 1),
					users: cellNumber(row, state.columns, 2)
				}
			})
		},
		[state.rows, state.columns, fallback, format]
	)
}

function BreakdownBarCard({
	title,
	data,
	state,
	color,
	labelWidth,
	onDrill
}: {
	title: string
	data: BreakdownDatum[]
	state: QueryState
	color: string
	labelWidth: number
	onDrill: (value: string) => void
}) {
	return (
		<ChartCard
			title={title}
			isLoading={state.isLoading}
			error={state.error}
			isEmpty={data.length === 0}
			className='h-[320px]'
			hint='Click a bar to filter'
		>
			<ResponsiveContainer width='100%' height='100%'>
				<BarChart data={data} layout='vertical' margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
					<CartesianGrid stroke='hsl(var(--border))' strokeDasharray='3 3' horizontal={false} />
					<XAxis type='number' tick={AXIS_TICK} tickFormatter={formatCompact} />
					<YAxis
						type='category'
						dataKey='label'
						tick={AXIS_TICK}
						width={labelWidth}
						interval={0}
					/>
					<Tooltip
						contentStyle={TOOLTIP_STYLE}
						cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
						formatter={(value: number, name: string) => [value.toLocaleString(), name]}
					/>
					<Bar
						dataKey='count'
						name='Events'
						fill={color}
						radius={[0, 4, 4, 0]}
						isAnimationActive={false}
						cursor='pointer'
						onClick={(entry: unknown) => {
							const value = drillValueOf(entry)
							if (value) onDrill(value)
						}}
					/>
				</BarChart>
			</ResponsiveContainer>
		</ChartCard>
	)
}

function DonutCard({
	title,
	data,
	state,
	onDrill
}: {
	title: string
	data: BreakdownDatum[]
	state: QueryState
	onDrill: (value: string) => void
}) {
	return (
		<ChartCard
			title={title}
			isLoading={state.isLoading}
			error={state.error}
			isEmpty={data.length === 0}
			className='h-[320px]'
			hint='Click a slice to filter'
		>
			<ResponsiveContainer width='100%' height='100%'>
				<PieChart>
					<Tooltip
						contentStyle={TOOLTIP_STYLE}
						formatter={(value: number, name: string) => [value.toLocaleString(), name]}
					/>
					<Legend wrapperStyle={{ fontSize: 12 }} />
					<Pie
						data={data}
						dataKey='count'
						nameKey='label'
						innerRadius='45%'
						outerRadius='78%'
						paddingAngle={1}
						isAnimationActive={false}
						cursor='pointer'
						onClick={(entry: unknown) => {
							const value = drillValueOf(entry)
							if (value) onDrill(value)
						}}
					>
						{data.map((_entry, index) => (
							<Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
						))}
					</Pie>
				</PieChart>
			</ResponsiveContainer>
		</ChartCard>
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
	days,
	isLoading,
	error,
	activeSite,
	onDrill
}: {
	sites: SiteRow[]
	days: number
	isLoading: boolean
	error: string | null
	activeSite?: string
	onDrill: (site: string) => void
}) {
	return (
		<div className='rounded-lg border border-sidebar-border bg-background'>
			<div className='flex items-center gap-2 border-b border-sidebar-border px-4 py-2.5 text-xs font-medium text-sidebar-foreground'>
				<Globe className='h-4 w-4 text-primary' />
				Monitored sites
				<span className='text-muted-foreground'>· last {days} days</span>
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
									<th className='hidden px-3 py-2 text-right font-medium sm:table-cell'>
										Last event
									</th>
								</tr>
							</thead>
							<tbody>
								{sites.map((row) => (
									<tr
										key={row.site}
										onClick={() => onDrill(row.site)}
										className={cn(
											'cursor-pointer border-t border-sidebar-border/60 hover:bg-sidebar-accent/10',
											activeSite === row.site && 'bg-primary/10'
										)}
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
								))}
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
	previous,
	days,
	isLoading,
	error
}: {
	icon: ReactNode
	label: string
	value: number | null
	previous: number | null
	days: number
	isLoading: boolean
	error: string | null
}) {
	const change = value === null || previous === null ? null : percentChange(value, previous)

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
			{!isLoading && !error && change !== null && (
				<div
					className={cn(
						'mt-1 flex items-center gap-1 text-[11px] tabular-nums',
						change >= 0 ? 'text-emerald-500' : 'text-rose-500'
					)}
				>
					{change >= 0 ? (
						<TrendingUp className='h-3 w-3' />
					) : (
						<TrendingDown className='h-3 w-3' />
					)}
					{formatPercent(change)}
					<span className='text-muted-foreground'>vs previous {days}d</span>
				</div>
			)}
		</div>
	)
}

function ChartCard({
	title,
	isLoading,
	error,
	isEmpty,
	className,
	hint,
	children
}: {
	title: string
	isLoading: boolean
	error: string | null
	isEmpty: boolean
	className?: string
	hint?: string
	children: ReactNode
}) {
	return (
		<div className='rounded-lg border border-sidebar-border bg-background'>
			<div className='flex items-center gap-2 border-b border-sidebar-border px-4 py-2.5 text-xs font-medium text-sidebar-foreground'>
				{title}
				{hint && !isLoading && !error && !isEmpty && (
					<span className='ml-auto text-[11px] font-normal text-muted-foreground'>{hint}</span>
				)}
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

/**
 * Pulls the raw property value out of a Recharts click payload. `Bar` hands back
 * the datum with its fields spread onto the entry, while `Pie` nests it under
 * `payload`, so both shapes are tried.
 */
function drillValueOf(entry: unknown): string | undefined {
	if (!entry || typeof entry !== 'object') return undefined
	const candidate = entry as { value?: unknown; payload?: { value?: unknown } }
	const raw = candidate.payload?.value ?? candidate.value
	return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/** Compacts large axis/tooltip numbers (12500 → 12.5K, 3_400_000 → 3.4M). */
function formatCompact(value: number): string {
	if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
	if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
	return String(value)
}

/** Renders a fractional change as a signed percentage (0.25 → +25%). */
function formatPercent(change: number): string {
	const percent = Math.round(change * 100)
	return `${percent >= 0 ? '+' : ''}${percent}%`
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
