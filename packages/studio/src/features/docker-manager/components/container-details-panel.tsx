import {
	ExternalLink,
	FileCode,
	Hash,
	Loader2,
	MoreHorizontal,
	Package,
	Play,
	Plug,
	RotateCw,
	Square,
	TerminalSquare,
	Trash2
} from 'lucide-react'
import { useState } from 'react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack } from '@studio/shared/ui/empty-state-illustrations'
import { toast } from '@studio/shared/ui/notifier'
import { PROJECT_LABEL_KEY } from '../constants'
import type { ContainerActionType, DockerContainer } from '../types'
import { isKeyValueContainer } from '../utilities/container-connection'
import { formatImage, formatShortAge, getContainerStatus } from '../utilities/container-status'
import { ComposeExportDialog } from './compose-export-dialog'
import { ConfigCard } from './config-card'
import { ConnectionCard } from './connection-card'
import { OutputCard } from './output-card'
import type { OutputTab } from './output-card'
import { ResourcesCard } from './resources-card'
import { SeedView } from './seed-view'
import { StatusDot } from './status-dot'

type Props = {
	container: DockerContainer | null
	pendingAction: ContainerActionType | null
	onAction: (containerId: string, action: ContainerActionType) => void
	onRemove: (container: DockerContainer) => void
	onOpenInDataViewer?: (container: DockerContainer) => void
	outputTab: OutputTab
	onOutputTabChange: (tab: OutputTab) => void
}

const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project'

function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

export function ContainerDetailsPanel({
	container,
	pendingAction,
	onAction,
	onRemove,
	onOpenInDataViewer,
	outputTab,
	onOutputTabChange
}: Props) {
	const [showExportDialog, setShowExportDialog] = useState(false)
	const [showSecrets, setShowSecrets] = useState(false)

	if (!container) {
		return (
			<EmptyState
				className='h-full'
				size='sm'
				headingLevel='h3'
				loop
				pointer
				illustration={<IconStack icon={<Package />} />}
				title='No container selected'
				description='Adjust the filters or create a new container.'
			/>
		)
	}

	const activeContainer = container
	const isRunning = activeContainer.state === 'running'
	const isBusy = pendingAction !== null
	const isKeyValue = isKeyValueContainer(activeContainer)
	const status = getContainerStatus(activeContainer.state, activeContainer.health, pendingAction)
	const shortId = activeContainer.id.slice(0, 12)
	const composeProject =
		activeContainer.labels[COMPOSE_PROJECT_LABEL] ?? activeContainer.labels[PROJECT_LABEL_KEY]
	const persistentVolumes = activeContainer.volumes.filter((volume) => !volume.isEphemeral)

	let stateMeta = `Created ${formatShortAge(activeContainer.createdAt)} ago`
	if (activeContainer.state === 'created') stateMeta += ', never started'
	if (isBusy) stateMeta = `${status.label}…`

	function runAction(action: ContainerActionType) {
		onAction(activeContainer.id, action)
	}

	async function handleCopyId() {
		try {
			await navigator.clipboard.writeText(activeContainer.id)
			toast.success('Container ID copied')
		} catch (error) {
			toast.error('Failed to copy container ID', {
				description: error instanceof Error ? error.message : String(error)
			})
		}
	}

	const infoRows: Array<[string, string]> = [
		['Created', formatTimestamp(activeContainer.createdAt)],
		['Health check', activeContainer.health === 'none' ? 'none' : activeContainer.health],
		[
			'Storage',
			persistentVolumes.length > 0
				? `${persistentVolumes.length} persistent ${persistentVolumes.length === 1 ? 'volume' : 'volumes'}`
				: 'ephemeral'
		],
		['Compose project', composeProject || '—'],
		['Container ID', shortId]
	]

	return (
		<>
			<header className='dk-dh'>
				<div className='dk-dh-l'>
					<div className='dk-dh-title'>
						<h2 className='dk-dh-name dk-mono'>{activeContainer.name}</h2>
						{activeContainer.origin === 'external' && (
							<span className='dk-ext' title='Not created by Dora'>
								external
							</span>
						)}
					</div>
					<div className='dk-dh-meta'>
						<span className='dk-st' role='status'>
							<StatusDot tone={status.tone} />
							{status.label}
						</span>
						<span className='dk-sep' />
						<span>{stateMeta}</span>
						<span className='dk-sep' />
						<span className='dk-mono'>{formatImage(activeContainer)}</span>
						<span className='dk-sep' />
						<span className='dk-mono dk-faint'>{shortId}</span>
					</div>
				</div>
				<div className='dk-acts'>
					{(isRunning || isBusy) && (
						<button
							type='button'
							className='dk-ibtn'
							onClick={() => runAction('restart')}
							disabled={isBusy}
							aria-label='Restart container'
							title='Restart'
						>
							<RotateCw className='h-[15px] w-[15px]' aria-hidden='true' />
						</button>
					)}
					{isBusy ? (
						<button type='button' className='dk-btn' data-variant='secondary' disabled>
							<Loader2 className='dk-spin h-3.5 w-3.5' aria-hidden='true' />
							{status.label}…
						</button>
					) : isRunning ? (
						<button
							type='button'
							className='dk-btn'
							data-variant='secondary'
							onClick={() => runAction('stop')}
						>
							<Square className='h-3 w-3' aria-hidden='true' />
							Stop
						</button>
					) : (
						<button
							type='button'
							className='dk-btn'
							data-variant='primary'
							onClick={() => runAction('start')}
						>
							<Play className='h-3 w-3' aria-hidden='true' />
							Start
						</button>
					)}
					<button
						type='button'
						className='dk-btn'
						data-variant={isRunning && !isBusy ? 'primary' : 'secondary'}
						onClick={() => onOpenInDataViewer?.(activeContainer)}
						disabled={!isRunning || isBusy}
						title={isRunning ? undefined : 'Start the container first'}
					>
						{isKeyValue ? (
							<ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
						) : (
							<Plug className='h-3.5 w-3.5' aria-hidden='true' />
						)}
						{isKeyValue ? 'Open in KV Studio' : 'Open in Dora'}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type='button' className='dk-ibtn' aria-label='More actions'>
								<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end' className='dk-menu'>
							<DropdownMenuItem
								disabled={!isRunning}
								onSelect={() => onOutputTabChange('shell')}
							>
								<TerminalSquare className='mr-2 h-3.5 w-3.5' aria-hidden='true' />
								Open shell
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setShowExportDialog(true)}>
								<FileCode className='mr-2 h-3.5 w-3.5' aria-hidden='true' />
								Export compose file
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void handleCopyId()}>
								<Hash className='mr-2 h-3.5 w-3.5' aria-hidden='true' />
								Copy container ID
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								disabled={isBusy}
								onSelect={() => onRemove(activeContainer)}
								className='text-destructive-foreground focus:text-destructive-foreground'
							>
								<Trash2 className='mr-2 h-3.5 w-3.5' aria-hidden='true' />
								<span className='flex flex-col'>
									Remove container
									<span className='dk-menu-s'>
										{activeContainer.volumes.length > 0
											? 'You choose whether volumes are kept'
											: 'No volumes attached'}
									</span>
								</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<div className='dk-dg'>
				<ConnectionCard
					container={activeContainer}
					showSecrets={showSecrets}
					onToggleSecrets={() => setShowSecrets((value) => !value)}
					onStart={() => runAction('start')}
					isActionPending={isBusy}
				/>
				<ResourcesCard container={activeContainer} />
				<ConfigCard container={activeContainer} showSecrets={showSecrets} />
				<section className='dk-card' style={{ gridArea: 'info' }} aria-label='Container'>
					<div className='dk-card-h'>
						<span className='dk-eyebrow'>Container</span>
						<span className='dk-card-r'>
							<span className='dk-meta dk-mono'>
								{activeContainer.origin === 'external'
									? 'external'
									: 'managed by Dora'}
							</span>
						</span>
					</div>
					<div className='dk-card-b'>
						<div className='dk-info'>
							{infoRows.map(([label, value]) => (
								<div key={label} className='contents'>
									<span className='dk-info-k'>{label}</span>
									<span className='dk-info-v dk-mono' title={value}>
										{value}
									</span>
								</div>
							))}
						</div>
					</div>
				</section>
				<OutputCard
					container={activeContainer}
					tab={isRunning ? outputTab : 'logs'}
					onTabChange={onOutputTabChange}
				/>
				{!isKeyValue && (
					<section
						className='dk-card'
						style={{ gridArea: 'seed' }}
						aria-label='Seed data'
					>
						<div className='dk-card-h'>
							<span className='dk-eyebrow'>Seed data</span>
						</div>
						<div className='dk-card-b'>
							<SeedView container={activeContainer} />
						</div>
					</section>
				)}
			</div>

			<ComposeExportDialog
				container={activeContainer}
				open={showExportDialog}
				onOpenChange={setShowExportDialog}
			/>
		</>
	)
}
