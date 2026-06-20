/**
 * ORM cockpit — link a project folder, see how its schema drifts from the live
 * database, and preview a migration that reconciles the two. Preview-only (plan
 * 06/07): nothing is applied from here; the generated SQL is handed off to the
 * SQL console where the normal prod-safety guardrails apply.
 *
 * This component is surface only — all orchestration lives in `useOrmCockpit`.
 */

import { useEffect, useState } from 'react'
import {
	FolderGit2,
	Loader2,
	RefreshCw,
	Database,
	ChevronDown,
	Wand2,
	AlertCircle,
} from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@studio/shared/ui/button'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { cn } from '@studio/shared/utils/cn'
import type { MigrationResult } from '@studio/features/orm-cockpit/migration/generate-sql'
import { useOrmCockpit } from '@studio/features/orm-cockpit/components/use-orm-cockpit'
import { DriftView } from '@studio/features/orm-cockpit/components/drift-view'
import { MigrationPreview } from '@studio/features/orm-cockpit/components/migration-preview'

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

export function OrmCockpitPanel({
	activeConnectionId,
	onOpenInSqlConsole,
	windowControls,
}: Props) {
	const cockpit = useOrmCockpit(activeConnectionId)
	const [migration, setMigration] = useState<MigrationResult | null>(null)
	const [notesOpen, setNotesOpen] = useState(false)

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
		[cockpit.diff],
	)

	return (
		<div className='flex h-full w-full flex-col bg-background text-sm'>
			<header className='flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-2'>
				<div className='flex items-center gap-2 px-2'>
					<Database className='h-4 w-4 text-muted-foreground' />
					<span className='font-semibold text-sidebar-foreground'>ORM Cockpit</span>
					{cockpit.linked ? (
						<span className='flex items-center gap-1 text-xs text-muted-foreground'>
							<span className='capitalize'>{cockpit.linked.orm}</span>
							<span>·</span>
							<span className='font-mono' title={cockpit.linked.folder}>
								{shortFolder(cockpit.linked.folder)}
							</span>
						</span>
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
							<RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
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

			<div className='min-h-0 flex-1'>
				{renderBody()}
			</div>
		</div>
	)

	function renderBody() {
		if (!activeConnectionId) {
			return (
				<EmptyState
					icon={<Database className='h-10 w-10' />}
					title='No database connection'
					description='Select a connection to compare a linked project against its live schema.'
				/>
			)
		}

		if (busy && !cockpit.diff) {
			return (
				<div className='flex h-full flex-col items-center justify-center gap-3 text-muted-foreground'>
					<Loader2 className='h-6 w-6 animate-spin' />
					<span className='text-sm'>
						{cockpit.phase === 'linking' ? 'Detecting project…' : 'Analyzing schema drift…'}
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
				<EmptyState
					icon={<FolderGit2 className='h-10 w-10' />}
					title='Link a project folder'
					description='Compare a Drizzle or Prisma project’s schema with this database to detect drift and preview a migration.'
					action={{ label: 'Link project', onClick: cockpit.link }}
				/>
			)
		}

		if (!cockpit.diff.hasChanges) {
			return (
				<div className='flex h-full flex-col'>
					{renderNotes()}
					<EmptyState
						icon={<Database className='h-10 w-10 text-emerald-500' />}
						title='In sync'
						description='The linked project’s schema matches the live database. No migration needed.'
					/>
				</div>
			)
		}

		return (
			<div className='flex h-full flex-col'>
				{renderNotes()}
				<PanelGroup direction='horizontal' className='flex-1'>
					<Panel defaultSize={50} minSize={30}>
						<div className='flex h-full flex-col'>
							<div className='flex items-center justify-between border-b border-border/60 px-3 py-2'>
								<span className='text-xs font-medium text-muted-foreground'>
									Schema drift
								</span>
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
			</div>
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
						className={cn('h-3.5 w-3.5 transition-transform', !notesOpen && '-rotate-90')}
					/>
					<AlertCircle className='h-3.5 w-3.5' />
					{cockpit.notes.length} note{cockpit.notes.length === 1 ? '' : 's'} from parse / diff /
					generate
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
