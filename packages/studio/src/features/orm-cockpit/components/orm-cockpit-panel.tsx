import { useEffect, useMemo, useState } from 'react'
import {
	AlertCircle,
	ArrowLeftRight,
	Check,
	CheckCircle2,
	ChevronDown,
	Database,
	FolderGit2,
	FolderPlus,
	GitCompareArrows,
	ListChecks,
	RefreshCw,
	ShieldCheck
} from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Button } from '@studio/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack } from '@studio/shared/ui/empty-state-illustrations'
import { SchemaDiffBodySkeleton } from '@studio/shared/ui/view-loading-shell'
import { useColorScheme } from '@studio/shared/hooks/use-color-scheme'
import { cn } from '@studio/shared/utils/cn'
import { useConnections } from '@studio/core/data-provider'
import type { Connection } from '@studio/features/connections/types'
import type { TableDiff } from '@studio/features/orm-cockpit/diff/types'
import { CockpitEmptySkeleton } from '@studio/features/orm-cockpit/components/cockpit-empty-skeleton'
import { useOrmCockpit } from '@studio/features/orm-cockpit/components/use-orm-cockpit'
import { useMigrationStatus } from '@studio/features/orm-cockpit/components/use-migration-status'
import {
	DriftView,
	type DiffRef,
	type RiskFilter
} from '@studio/features/orm-cockpit/components/drift-view'
import { MigrationPreview } from '@studio/features/orm-cockpit/components/migration-preview'
import { MigrationStatusView } from '@studio/features/orm-cockpit/components/migration-status-view'
import { ConverterPanel } from '@studio/features/orm-cockpit/components/converter-panel'
import { buildMigrationPlan } from '@studio/features/orm-cockpit/components/migration-plan'
import '@studio/features/orm-cockpit/orm-cockpit.css'

type CockpitTab = 'drift' | 'migrations' | 'converter'

type Props = {
	activeConnectionId: string | undefined
	onOpenInSqlConsole?: (sql: string) => void
	windowControls?: React.ReactNode
}

function shortFolder(path: string): string {
	const parts = path.replace(/\/+$/, '').split('/')
	return parts.slice(-2).join('/') || path
}

function relativeWorkspace(linkedFolder: string | null, rootDir: string): string | null {
	if (!linkedFolder) {
		return null
	}
	const base = linkedFolder.replace(/\/+$/, '')
	const root = rootDir.replace(/\/+$/, '')
	if (root === base) {
		return null
	}
	return root.startsWith(`${base}/`) ? root.slice(base.length + 1) : shortFolder(root)
}

function relativeFile(folder: string, path: string): string {
	const base = folder.replace(/\/+$/, '')
	return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : shortFolder(path)
}

function ormLabel(orm: string): string {
	return orm === 'prisma' ? 'Prisma' : 'Drizzle'
}

function connectionDetail(connection: Connection): string {
	const where = connection.host ?? connection.database ?? ''
	return where ? `${connection.type} · ${where}` : connection.type
}

function ConnectionPicker({
	connections,
	selectedId,
	onSelect,
	disabled
}: {
	connections: Connection[] | undefined
	selectedId: string | undefined
	onSelect: (id: string) => void
	disabled?: boolean
}) {
	const selected = connections?.find((c) => c.id === selectedId)
	if (!connections || connections.length === 0) {
		return null
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type='button' className='sd-chip' disabled={disabled}>
					<Database className='sd-chip-ic' />
					<span className='sd-chip-k'>database</span>
					<span className='sd-chip-v'>{selected?.name ?? 'Select connection'}</span>
					{selected ? <span className='sd-chip-s'>{selected.type}</span> : null}
					<ChevronDown className='sd-chip-chev' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='max-h-[320px] w-72 overflow-y-auto'>
				<DropdownMenuLabel className='sd-eyebrow'>Compare against</DropdownMenuLabel>
				{connections.map(function (connection) {
					return (
						<DropdownMenuItem
							key={connection.id}
							onClick={() => onSelect(connection.id)}
							className='gap-2.5'
						>
							<Database className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
							<span className='flex min-w-0 flex-1 flex-col'>
								<span className='truncate text-xs font-medium text-foreground'>
									{connection.name}
								</span>
								<span className='truncate font-mono text-[11px] text-muted-foreground'>
									{connectionDetail(connection)}
								</span>
							</span>
							{connection.id === selectedId ? (
								<Check className='h-3.5 w-3.5 shrink-0 text-foreground' />
							) : null}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function FolderPicker({
	folder,
	orm,
	schemaFile,
	onLink,
	disabled
}: {
	folder: string
	orm: string
	schemaFile: string | null
	onLink: () => void
	disabled?: boolean
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type='button' className='sd-chip' disabled={disabled} title={folder}>
					<FolderGit2 className='sd-chip-ic' />
					<span className='sd-chip-k'>code</span>
					<span className='sd-chip-v'>{shortFolder(folder)}</span>
					<span className='sd-chip-s'>{ormLabel(orm)}</span>
					<ChevronDown className='sd-chip-chev' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-72'>
				<DropdownMenuLabel className='sd-eyebrow'>Linked folder</DropdownMenuLabel>
				<div className='flex items-center gap-2.5 px-2 py-1.5'>
					<FolderGit2 className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
					<span className='flex min-w-0 flex-1 flex-col'>
						<span className='truncate text-xs font-medium text-foreground'>
							{shortFolder(folder)}
						</span>
						<span className='truncate font-mono text-[11px] text-muted-foreground'>
							{schemaFile ? `${schemaFile} · ` : ''}
							{ormLabel(orm)}
						</span>
					</span>
					<Check className='h-3.5 w-3.5 shrink-0 text-foreground' />
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onLink} className='gap-2.5 text-xs'>
					<FolderPlus className='h-3.5 w-3.5 text-muted-foreground' />
					Link different folder…
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function MismatchBanner({
	projectLabel,
	connectionLabel
}: {
	projectLabel: string
	connectionLabel: string
}) {
	return (
		<div className='sd-banner'>
			<span className='sd-dot is-review' />
			<span>
				This project's <code>DATABASE_URL</code> points at <b>{projectLabel}</b>, but you're
				comparing against <b>{connectionLabel}</b>. They look like different databases, so
				the diff below is likely meaningless. Switch the database above, or proceed if you
				know what you're doing.
			</span>
		</div>
	)
}

function Code({ children }: { children: React.ReactNode }) {
	return (
		<code className='rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground/80'>
			{children}
		</code>
	)
}

function HowItWorks() {
	const items = [
		{
			icon: GitCompareArrows,
			label: 'Differences',
			body: (
				<>
					reads your <Code>schema.ts</Code> / <Code>schema.prisma</Code> and the live
					database, then generates fresh SQL, like <Code>drizzle-kit push</Code>.
				</>
			)
		},
		{
			icon: ListChecks,
			label: 'Migrations',
			body: (
				<>
					reads your <Code>drizzle/</Code> journal and shows which generated migrations
					this database has applied vs. pending.
				</>
			)
		},
		{
			icon: ShieldCheck,
			label: 'Read-only',
			body: (
				<>
					generated SQL opens in the SQL console, where the usual guardrails apply.
					Nothing is ever applied from here.
				</>
			)
		}
	]
	return (
		<div className='mt-8 w-full border-t border-border/50 pt-6 text-left'>
			<p className='mb-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70'>
				How this works
			</p>
			<ul className='space-y-3.5'>
				{items.map(function (item) {
					const Icon = item.icon
					return (
						<li key={item.label} className='flex gap-3'>
							<span className='mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground'>
								<Icon className='h-3.5 w-3.5' />
							</span>
							<p className='text-xs leading-relaxed text-muted-foreground'>
								<span className='font-medium text-foreground/90'>{item.label}</span>{' '}
								{item.body}
							</p>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function toggleInMap(
	map: ReadonlyMap<string, boolean>,
	tables: TableDiff[],
	value: boolean
): Map<string, boolean> {
	const next = new Map(map)
	for (const table of tables) next.set(table.name, value)
	return next
}

export function OrmCockpitPanel({ activeConnectionId, onOpenInSqlConsole, windowControls }: Props) {
	const cockpit = useOrmCockpit(activeConnectionId)
	const { data: connections } = useConnections()
	const colorScheme = useColorScheme()
	const compareConnectionId = cockpit.compareConnectionId
	const connectionName =
		connections?.find((c) => c.id === compareConnectionId)?.name ?? 'this database'
	const [notesOpen, setNotesOpen] = useState(false)
	const [tab, setTab] = useState<CockpitTab>('drift')
	const [includeOverrides, setIncludeOverrides] = useState<Map<string, boolean>>(() => new Map())
	const [openOverrides, setOpenOverrides] = useState<Map<string, boolean>>(() => new Map())
	const [filter, setFilter] = useState<RiskFilter>('all')
	const [hovered, setHovered] = useState<DiffRef | null>(null)
	const [pinned, setPinned] = useState<DiffRef | null>(null)
	const [includeDestructive, setIncludeDestructive] = useState(false)
	const [includeReview, setIncludeReview] = useState(false)

	const migrationStatus = useMigrationStatus({
		folder: cockpit.linked?.folder ?? null,
		configPath: cockpit.linked?.link.configPath,
		orm: cockpit.linked?.orm ?? null,
		connectionId: compareConnectionId,
		dialect: cockpit.dialect
	})

	const busy = cockpit.phase === 'linking' || cockpit.phase === 'analyzing'

	function isIncluded(table: TableDiff): boolean {
		return includeOverrides.get(table.name) ?? table.kind !== 'removed'
	}

	function isOpen(table: TableDiff): boolean {
		return (
			openOverrides.get(table.name) ??
			(table.kind === 'changed' && table.confidence !== 'safe')
		)
	}

	const includedNames = useMemo(
		function () {
			const names = new Set<string>()
			for (const table of cockpit.diff?.tables ?? []) {
				if (includeOverrides.get(table.name) ?? table.kind !== 'removed') {
					names.add(table.name)
				}
			}
			return names
		},
		[cockpit.diff, includeOverrides]
	)

	const plan = useMemo(
		function () {
			return buildMigrationPlan(cockpit.migration?.statements ?? [], {
				included: includedNames,
				includeDestructive,
				includeReview,
				wrapped: cockpit.dialect === 'postgres'
			})
		},
		[cockpit.migration, includedNames, includeDestructive, includeReview, cockpit.dialect]
	)

	const [sqlHovered, setSqlHovered] = useState<DiffRef | null>(null)
	const linkedTables = useMemo(
		function () {
			return new Set(sqlHovered ? [sqlHovered.table] : [])
		},
		[sqlHovered]
	)

	useEffect(
		function () {
			setPinned(null)
			setHovered(null)
		},
		[cockpit.diff]
	)

	useEffect(function () {
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') setPinned(null)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

	const schemaFile = cockpit.linked?.link.schemaFiles[0]
		? relativeFile(cockpit.linked.folder, cockpit.linked.link.schemaFiles[0].path)
		: null
	const analyzed = Boolean(cockpit.linked && cockpit.diff)

	return (
		<div className='orm-cockpit flex h-full w-full flex-col text-sm' data-scheme={colorScheme}>
			<header className='sd-tb'>
				<div className='sd-tb-l'>
					<div className='sd-title'>
						<GitCompareArrows className='sd-title-ic' />
						Schema Diff
					</div>
					{cockpit.linked || (connections && connections.length > 0) ? (
						<span className='sd-tb-div' />
					) : null}
					<div className='sd-pair'>
						{cockpit.linked ? (
							<>
								<FolderPicker
									folder={cockpit.linked.folder}
									orm={cockpit.linked.orm}
									schemaFile={schemaFile}
									onLink={cockpit.link}
									disabled={busy}
								/>
								<ArrowLeftRight
									className='sd-pair-arrow'
									aria-label='compared with'
								/>
							</>
						) : null}
						<ConnectionPicker
							connections={connections}
							selectedId={compareConnectionId}
							onSelect={cockpit.setCompareConnection}
							disabled={busy}
						/>
					</div>
				</div>
				<div className='sd-tb-r'>
					{cockpit.linked ? (
						<button
							type='button'
							className='sd-btn is-ghost'
							onClick={cockpit.rescan}
							disabled={busy}
						>
							{busy ? <Spinner className='h-3.5 w-3.5' /> : <RefreshCw />}
							Refresh
						</button>
					) : (
						<button
							type='button'
							className='sd-btn is-outline'
							onClick={cockpit.link}
							disabled={busy}
						>
							<FolderGit2 />
							Link project
						</button>
					)}
					{windowControls}
				</div>
			</header>

			{cockpit.connectionMismatch ? (
				<MismatchBanner
					projectLabel={cockpit.connectionMismatch.projectLabel}
					connectionLabel={cockpit.connectionMismatch.connectionLabel}
				/>
			) : null}

			{renderTabBar()}
			<div className='min-h-0 flex-1'>
				{tab === 'converter' ? <ConverterPanel /> : renderBody()}
			</div>
		</div>
	)

	function renderBody() {
		if (!compareConnectionId) {
			return (
				<EmptyState
					loop
					illustration={<IconStack icon={<Database />} />}
					title='No database connection'
					description='Pick a connection above, then link a project to compare your code schema against it.'
				/>
			)
		}

		if (busy && !cockpit.diff) {
			return <SchemaDiffBodySkeleton />
		}

		if (cockpit.phase === 'choice' && cockpit.choices) {
			const distinctOrms = new Set(cockpit.choices.map((o) => o.orm)).size
			const heading =
				distinctOrms > 1 && cockpit.choices.length === distinctOrms
					? 'This project has both Drizzle and Prisma'
					: 'This project has more than one schema'
			return (
				<div className='mx-auto flex max-w-md flex-col gap-3 p-8'>
					<h3 className='text-base font-medium text-foreground'>{heading}</h3>
					<p className='text-sm text-muted-foreground'>
						Pick which schema to compare against the live database.
					</p>
					{cockpit.choices.map(function (option) {
						const workspace = relativeWorkspace(cockpit.choiceFolder, option.rootDir)
						return (
							<Button
								key={`${option.orm}:${option.rootDir}`}
								variant='outline'
								className='h-auto justify-start py-2 capitalize'
								onClick={() => void cockpit.chooseOrm(option)}
							>
								<FolderGit2 className='mr-2 h-4 w-4 shrink-0' />
								<span className='flex flex-col items-start'>
									<span>
										{option.orm}
										{workspace ? (
											<span className='ml-2 font-mono text-xs lowercase text-muted-foreground'>
												{workspace}
											</span>
										) : null}
									</span>
									<span className='text-xs normal-case text-muted-foreground'>
										{option.schemaFiles.length} file
										{option.schemaFiles.length === 1 ? '' : 's'}
									</span>
								</span>
							</Button>
						)
					})}
				</div>
			)
		}

		if (cockpit.phase === 'error' && cockpit.error) {
			return (
				<EmptyState
					illustration={<IconStack icon={<AlertCircle />} />}
					title='Could not analyze the project'
					description={cockpit.error}
					actions={[{ id: 'link', label: 'Link a project', onClick: cockpit.link }]}
				/>
			)
		}

		if (!cockpit.linked || !cockpit.diff) {
			return (
				<div className='h-full overflow-auto'>
					<div className='mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-12'>
						<CockpitEmptySkeleton />
						<h3 className='mt-7 text-balance text-lg font-semibold text-foreground'>
							Does this database match your code?
						</h3>
						<p className='mt-2 text-pretty text-center text-sm leading-relaxed text-muted-foreground'>
							Link your Drizzle or Prisma project and Schema Diff shows exactly how
							your code schema differs from{' '}
							<span className='font-medium text-foreground/80'>{connectionName}</span>
							, plus the SQL to reconcile them.
						</p>
						<Button onClick={cockpit.link} className='mt-6 gap-1.5'>
							<FolderGit2 className='h-4 w-4' />
							Link project
						</Button>
						<HowItWorks />
					</div>
				</div>
			)
		}

		if (tab === 'migrations') {
			return <MigrationStatusView state={migrationStatus} connectionName={connectionName} />
		}

		return (
			<div className='flex h-full min-h-0 flex-col'>
				{renderNotes()}
				{renderDrift()}
			</div>
		)
	}

	function renderTabBar() {
		const pending = migrationStatus.status?.pendingCount ?? 0
		const tabs: Array<{
			id: CockpitTab
			label: string
			icon: React.ReactNode
			count?: string
		}> = [
			{
				id: 'drift',
				label: 'Differences',
				icon: <GitCompareArrows />,
				count: cockpit.diff?.hasChanges ? String(cockpit.diff.tables.length) : undefined
			},
			...(analyzed
				? [
						{
							id: 'migrations' as CockpitTab,
							label: 'Migrations',
							icon: <ListChecks />,
							count: pending > 0 ? `${pending} pending` : undefined
						}
					]
				: []),
			{ id: 'converter', label: 'Converter', icon: <ArrowLeftRight /> }
		]
		return (
			<div className='sd-tabs' role='tablist' aria-label='Schema Diff'>
				{tabs.map(function (t) {
					return (
						<button
							key={t.id}
							type='button'
							role='tab'
							aria-selected={tab === t.id}
							className='sd-tab'
							onClick={() => setTab(t.id)}
						>
							{t.icon}
							{t.label}
							{t.count ? <span className='sd-tab-cnt'>{t.count}</span> : null}
						</button>
					)
				})}
				{cockpit.linked && schemaFile ? (
					<span className='sd-tabs-r'>
						<span className='sd-mono'>{schemaFile}</span>
						<span>·</span>
						<span>{ormLabel(cockpit.linked.orm)}</span>
					</span>
				) : null}
			</div>
		)
	}

	function renderDrift() {
		const diff = cockpit.diff
		if (!diff) {
			return null
		}
		if (!diff.hasChanges) {
			return (
				<EmptyState
					illustration={<IconStack icon={<CheckCircle2 />} />}
					title='In sync'
					description={`Your code schema matches ${connectionName}. No changes needed.`}
				/>
			)
		}
		const systemTables =
			cockpit.hiddenCount > 0 || cockpit.showExternal
				? {
						hidden: cockpit.hiddenCount,
						shown: cockpit.showExternal,
						onToggle: () => cockpit.setShowExternal(!cockpit.showExternal)
					}
				: null
		return (
			<div className='sd-diff'>
				<DriftView
					diff={diff}
					plan={plan}
					connectionName={connectionName}
					included={isIncluded}
					onIncludeChange={(tables, include) =>
						setIncludeOverrides((prev) => toggleInMap(prev, tables, include))
					}
					isOpen={isOpen}
					onOpenChange={(tables, open) =>
						setOpenOverrides((prev) => toggleInMap(prev, tables, open))
					}
					filter={filter}
					onFilterChange={setFilter}
					hovered={hovered}
					pinned={pinned}
					linkedTables={linkedTables}
					linkedRef={sqlHovered}
					onHover={setHovered}
					onPin={(ref) =>
						setPinned((prev) =>
							prev && prev.table === ref.table && prev.target === ref.target
								? null
								: ref
						)
					}
					systemTables={systemTables}
				/>
				<MigrationPreview
					plan={plan}
					sourceLabel={`code → ${connectionName}`}
					hovered={hovered}
					pinned={pinned}
					includeDestructive={includeDestructive}
					includeReview={includeReview}
					onIncludeDestructiveChange={setIncludeDestructive}
					onIncludeReviewChange={setIncludeReview}
					onStatementHover={setSqlHovered}
					onOpenInSqlConsole={onOpenInSqlConsole}
				/>
			</div>
		)
	}

	function renderNotes() {
		if (cockpit.notes.length === 0) return null
		return (
			<div className='sd-notes'>
				<button
					type='button'
					onClick={() => setNotesOpen((v) => !v)}
					className='sd-notes-btn'
					aria-expanded={notesOpen}
				>
					<ChevronDown className={cn('sd-notes-chev', !notesOpen && 'is-closed')} />
					<span className='sd-dot is-review' />
					{cockpit.notes.length} note{cockpit.notes.length === 1 ? '' : 's'} from parse,
					diff and generate
				</button>
				{notesOpen ? (
					<ul className='sd-notes-list'>
						{cockpit.notes.map(function (note, i) {
							return (
								<li key={i}>
									<span className='sd-notes-src'>{note.source}</span>
									<span className='min-w-0'>{note.message}</span>
								</li>
							)
						})}
					</ul>
				) : null}
			</div>
		)
	}
}
