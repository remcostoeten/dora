/**
 * ORM cockpit — link a project folder,
	see how its schema drifts from the live
 * database,
	and preview a migration that reconciles the two. Preview-only (plan
 * 06/07): nothing is applied from here; the generated SQL is handed off to the
 * SQL console where the normal prod-safety guardrails apply.
 *
 * This component is surface only — all orchestration lives in `useOrmCockpit`.
 */

import { useEffect, useState } from 'react'
import {
	FolderGit2,
	RefreshCw,
	Database,
	ChevronDown,
	Wand2,
	AlertCircle,
	GitCompareArrows,
	ListChecks,
	ShieldCheck,
	Eye,
	EyeOff
} from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@studio/shared/ui/button'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { CockpitEmptySkeleton } from './cockpit-empty-skeleton'
import { cn } from '@studio/shared/utils/cn'
import { useConnections } from '@studio/core/data-provider'
import type { MigrationResult } from '@studio/features/orm-cockpit/migration/generate-sql'
import { useOrmCockpit } from '@studio/features/orm-cockpit/components/use-orm-cockpit'
import { useMigrationStatus } from '@studio/features/orm-cockpit/components/use-migration-status'
import { DriftView } from '@studio/features/orm-cockpit/components/drift-view'
import { MigrationPreview } from '@studio/features/orm-cockpit/components/migration-preview'
import { MigrationStatusView } from '@studio/features/orm-cockpit/components/migration-status-view'

type CockpitTab = 'drift' | 'migrations'

type Props = {
	activeConnectionId: string | undefined
	/** Hand generated SQL to the SQL console (Index wires this to nav + event). */
	onOpenInSqlConsole?: (sql: string) => void
	/** Window controls slot, rendered in the header (matches other full views). */
	windowControls?: React.ReactNode
}

function shortFolder(path: string): string {
	const parts = path.replace(/\/+$/, '').split('/')
	return parts.slice(-2).join('/') || path
}

/**
 * The always-visible "what is being compared against what" indicator:
 * `your code <folder>  ⟷  ● <database>`. Keeping this in the header means the
 * user never has to wonder which direction the diff runs or which DB it hit.
 */
function CompareContext({
	orm,
	folder,
	connectionName
}: {
	orm: string
	folder: string
	connectionName: string
}) {
	return (
		<span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
			<span>your code</span>
			<span className='font-mono text-foreground/70' title={`${folder} · ${orm}`}>
				{shortFolder(folder)}
			</span>
			<GitCompareArrows className='h-3 w-3' />
			<Database className='h-3 w-3 text-emerald-500' />
			<span className='font-mono text-foreground/70'>{connectionName}</span>
		</span>
	)
}

function Code({ children }: { children: React.ReactNode }) {
	return (
		<code className='rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground/80'>
			{children}
		</code>
	)
}

/**
 * Sets expectations on the link screen. The cockpit is push-style: it reads
 * your schema source and the live DB and computes the diff itself — it does
 * NOT read the `drizzle/` migration files. Spelling that out here avoids the
 * common "why isn't it showing my migrations?" confusion.
 */
function HowItWorks() {
	const items = [
		{
			icon: GitCompareArrows,
			label: 'Differences',
			body: (
				<>
					reads your <Code>schema.ts</Code> / <Code>schema.prisma</Code> and the live
					database, then generates fresh SQL — like <Code>drizzle-kit push</Code>.
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
					generated SQL opens in the SQL console, where the usual guardrails apply —
					nothing is ever applied from here.
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

export function OrmCockpitPanel({ activeConnectionId, onOpenInSqlConsole, windowControls }: Props) {
	const cockpit = useOrmCockpit(activeConnectionId)
	const { data: connections } = useConnections()
	const connectionName =
		connections?.find(function (c) {
			return c.id === activeConnectionId
		})?.name ?? 'this database'
	const [migration, setMigration] = useState<MigrationResult | null>(null)
	const [notesOpen, setNotesOpen] = useState(false)
	const [tab, setTab] = useState<CockpitTab>('drift')

	const migrationStatus = useMigrationStatus({
		folder: cockpit.linked?.folder ?? null,
		configPath: cockpit.linked?.link.configPath,
		orm: cockpit.linked?.orm ?? null,
		connectionId: activeConnectionId,
		dialect: cockpit.dialect
	})

	const busy = cockpit.phase === 'linking' || cockpit.phase === 'analyzing'

	function handleGenerate() {
		const result = cockpit.generate()
		setMigration(result)
	}

	// Clear a stale preview whenever the diff changes underneath it.
	useEffect(
		function () {
			setMigration(null)
		},
		[cockpit.diff]
	)

	return (
		<div className='flex h-full w-full flex-col bg-background text-sm'>
			<header className='flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-2'>
				<div className='flex items-center gap-2 px-2'>
					<GitCompareArrows className='h-4 w-4 text-muted-foreground' />
					<span className='font-semibold text-sidebar-foreground'>Schema Diff</span>
					{cockpit.linked ? (
						<CompareContext
							orm={cockpit.linked.orm}
							folder={cockpit.linked.folder}
							connectionName={connectionName}
						/>
					) : null}
				</div>
				<div className='flex items-center gap-1'>
					{cockpit.linked ? (
						<Button
							variant='ghost'
							size='sm'
							className='h-7 gap-1.5 text-xs'
							onClick={cockpit.rescan}
							disabled={busy}
						>
							{busy ? (
								<Spinner className='h-3.5 w-3.5' />
							) : (
								<RefreshCw className='h-3.5 w-3.5' />
							)}
							Refresh
						</Button>
					) : null}
					<Button
						variant='outline'
						size='sm'
						className='h-7 gap-1.5 text-xs'
						onClick={cockpit.link}
						disabled={busy}
					>
						<FolderGit2 className='h-3.5 w-3.5' />
						{cockpit.linked ? 'Link different folder' : 'Link project'}
					</Button>
					{windowControls}
				</div>
			</header>

			<div className='min-h-0 flex-1'>{renderBody()}</div>
		</div>
	)

	function renderBody() {
		if (!activeConnectionId) {
			return (
				<EmptyState
					icon={<Database className='h-10 w-10' />}
					title='No database connection'
					description='Select a connection, then link a project to compare your code schema against it.'
				/>
			)
		}

		if (busy && !cockpit.diff) {
			return (
				<div className='flex h-full flex-col items-center justify-center gap-3 text-muted-foreground'>
					<Spinner className='h-6 w-6' />
					<span className='text-sm'>
						{cockpit.phase === 'linking'
							? 'Detecting project…'
							: 'Comparing your code to the database…'}
					</span>
				</div>
			)
		}

		if (cockpit.phase === 'choice' && cockpit.choices) {
			return (
				<div className='mx-auto flex max-w-md flex-col gap-3 p-8'>
					<h3 className='text-base font-medium text-foreground'>
						This project has both Drizzle and Prisma
					</h3>
					<p className='text-sm text-muted-foreground'>
						Pick which schema to compare against the live database.
					</p>
					{cockpit.choices.map(function (option) {
						return (
							<Button
								key={option.orm}
								variant='outline'
								className='justify-start capitalize'
								onClick={function () {
									void cockpit.chooseOrm(option)
								}}
							>
								<FolderGit2 className='mr-2 h-4 w-4' />
								{option.orm}
								<span className='ml-2 text-xs text-muted-foreground'>
									{option.schemaFiles.length} file
									{option.schemaFiles.length === 1 ? '' : 's'}
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
					icon={<AlertCircle className='h-10 w-10 text-red-500' />}
					title='Could not analyze the project'
					description={cockpit.error}
					action={{ label: 'Link a project', onClick: cockpit.link }}
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
							Link your Drizzle or Prisma project and Schema Diff shows exactly how your
							code schema differs from{' '}
							<span className='font-medium text-foreground/80'>{connectionName}</span>,
							plus the SQL to reconcile them.
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

		return (
			<div className='flex h-full flex-col'>
				{renderTabBar()}
				{tab === 'migrations' ? (
					<MigrationStatusView state={migrationStatus} />
				) : (
					<div className='flex min-h-0 flex-1 flex-col'>
						{renderNotes()}
						{renderDrift()}
					</div>
				)}
			</div>
		)
	}

	function renderTabBar() {
		const tabs: Array<{ id: CockpitTab; label: string; icon: React.ReactNode }> = [
			{
				id: 'drift',
				label: 'Differences',
				icon: <GitCompareArrows className='h-3.5 w-3.5' />
			},
			{ id: 'migrations', label: 'Migrations', icon: <ListChecks className='h-3.5 w-3.5' /> }
		]
		return (
			<div className='flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-1'>
				{tabs.map(function (t) {
					const active = tab === t.id
					return (
						<button
							key={t.id}
							type='button'
							onClick={function () {
								setTab(t.id)
							}}
							className={cn(
								'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
								active
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
							)}
						>
							{t.icon}
							{t.label}
						</button>
					)
				})}
			</div>
		)
	}

	function renderDrift() {
		if (!cockpit.diff) {
			return null
		}
		if (!cockpit.diff.hasChanges) {
			return (
				<EmptyState
					icon={<Database className='h-10 w-10 text-emerald-500' />}
					title='In sync'
					description={`Your code schema matches ${connectionName}. No changes needed.`}
				/>
			)
		}
		return (
			<PanelGroup direction='horizontal' className='min-h-0 flex-1'>
				<Panel defaultSize={50} minSize={30}>
					<div className='flex h-full flex-col'>
						<div className='flex items-center justify-between border-b border-border/60 px-3 py-2'>
							<div className='flex items-center gap-2'>
								<span className='text-xs font-medium text-muted-foreground'>
									{connectionName}
								</span>
								{cockpit.hiddenCount > 0 || cockpit.showExternal ? (
									<button
										type='button'
										onClick={function () {
											cockpit.setShowExternal(!cockpit.showExternal)
										}}
										className='flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground'
										title='Migration bookkeeping and provider/system tables (e.g. Supabase auth, storage) are hidden by default.'
									>
										{cockpit.showExternal ? (
											<EyeOff className='h-3 w-3' />
										) : (
											<Eye className='h-3 w-3' />
										)}
										{cockpit.showExternal
											? 'Hide system tables'
											: `Show ${cockpit.hiddenCount} system table${cockpit.hiddenCount === 1 ? '' : 's'}`}
									</button>
								) : null}
							</div>
							<Button
								size='sm'
								className='h-7 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700'
								onClick={handleGenerate}
							>
								<Wand2 className='h-3.5 w-3.5' />
								Generate migration
							</Button>
						</div>
						<div className='min-h-0 flex-1 overflow-auto p-3'>
							<DriftView diff={cockpit.diff} />
						</div>
					</div>
				</Panel>
				<PanelResizeHandle className='w-1 bg-sidebar-border hover:bg-primary/20' />
				<Panel defaultSize={50} minSize={30}>
					{migration ? (
						<MigrationPreview
							migration={migration}
							onOpenInSqlConsole={onOpenInSqlConsole}
						/>
					) : (
						<EmptyState
							icon={<Wand2 className='h-8 w-8' />}
							title='No migration generated yet'
							description='Generate a migration from the drift on the left to preview the SQL.'
						/>
					)}
				</Panel>
			</PanelGroup>
		)
	}

	function renderNotes() {
		if (cockpit.notes.length === 0) return null
		return (
			<div className='border-b border-amber-500/30 bg-amber-500/5'>
				<button
					type='button'
					onClick={function () {
						setNotesOpen(function (v) {
							return !v
						})
					}}
					className='flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
					aria-expanded={notesOpen}
				>
					<ChevronDown
						className={cn(
							'h-3.5 w-3.5 transition-transform',
							!notesOpen && '-rotate-90'
						)}
					/>
					<AlertCircle className='h-3.5 w-3.5' />
					{cockpit.notes.length} note{cockpit.notes.length === 1 ? '' : 's'} from parse /
					diff / generate
				</button>
				{notesOpen ? (
					<ul className='max-h-40 overflow-auto px-3 pb-2 text-xs text-muted-foreground'>
						{cockpit.notes.map(function (note, i) {
							return (
								<li key={i} className='flex gap-2 py-0.5'>
									<span className='shrink-0 font-mono uppercase text-[10px] text-amber-600/80 dark:text-amber-400/80'>
										{note.source}
									</span>
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
