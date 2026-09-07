import {
	Play,
	Square,
	RotateCcw,
	Trash2,
	ExternalLink,
	FileCode,
	TerminalSquare
} from 'lucide-react'
import { Package } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { useContainerActions, useRemoveContainer } from '../api/mutations/use-container-actions'
import type { DockerContainer } from '../types'
import { ConnectionDetails } from './connection-details'
import { ContainerMetrics } from './container-metrics'
import { SeedView } from './seed-view'
import { StatusBadge } from './status-badge'
import { ComposeExportDialog } from './compose-export-dialog'
import { RemoveContainerDialog } from './remove-container-dialog'
import { RemoveContainerOptions } from '../types'

type Props = {
	container: DockerContainer | null
	onOpenInDataViewer?: (container: DockerContainer) => void
	onOpenTerminal?: (container: DockerContainer) => void
	onRemoveComplete?: () => void
}

export function ContainerDetailsPanel({
	container,
	onOpenInDataViewer,
	onOpenTerminal,
	onRemoveComplete
}: Props) {
	const [showExportDialog, setShowExportDialog] = useState(false)
	const [showRemoveDialog, setShowRemoveDialog] = useState(false)

	const containerActions = useContainerActions()
	const removeContainer = useRemoveContainer({
		onSuccess: function () {
			if (onRemoveComplete) {
				onRemoveComplete()
			}
		}
	})

	if (!container) {
		return (
			<div className='flex-1 flex items-center justify-center p-8 border-l border-border'>
				<div className='text-center'>
					<Package className='h-12 w-12 mx-auto mb-4 text-muted-foreground/50' />
					<h3 className='text-sm font-medium mb-1'>Select a container</h3>
					<p className='text-xs text-muted-foreground max-w-[200px]'>
						Click on a container from the list to view its details and available
						actions.
					</p>
				</div>
			</div>
		)
	}

	const activeContainer = container
	const isRunning = activeContainer.state === 'running'

	function handleStart() {
		containerActions.mutate({ containerId: activeContainer.id, action: 'start' })
	}

	function handleStop() {
		containerActions.mutate({ containerId: activeContainer.id, action: 'stop' })
	}

	function handleRestart() {
		containerActions.mutate({ containerId: activeContainer.id, action: 'restart' })
	}

	function handleRemove() {
		setShowRemoveDialog(true)
	}

	function handleConfirmRemove(options: RemoveContainerOptions) {
		removeContainer.mutate({
			containerId: activeContainer.id,
			options
		})
		setShowRemoveDialog(false)
	}

	function handleOpenInViewer() {
		if (onOpenInDataViewer) {
			onOpenInDataViewer(activeContainer)
		}
	}

	return (
		<div className='w-80 min-h-0 flex flex-col border-l border-border bg-card overflow-hidden'>
			<div className='shrink-0 p-4 border-b border-border'>
				<div className='flex items-start justify-between gap-2'>
					<div className='min-w-0'>
						<h3 className='font-medium text-sm truncate'>{container.name}</h3>
						<div className='mt-1 text-xs text-muted-foreground'>
							{container.image}:{container.imageTag}
						</div>
					</div>
					<StatusBadge state={container.state} health={container.health} />
				</div>

				<div className='mt-3 flex items-center gap-1'>
					{!isRunning ? (
						<Button
							variant='outline'
							size='icon-sm'
							aria-label='Start container'
							title='Start'
							onClick={handleStart}
							disabled={containerActions.isPending}
						>
							<Play className='h-3.5 w-3.5' />
						</Button>
					) : (
						<Button
							variant='outline'
							size='icon-sm'
							aria-label='Stop container'
							title='Stop'
							onClick={handleStop}
							disabled={containerActions.isPending}
						>
							<Square className='h-3.5 w-3.5' />
						</Button>
					)}

					<Button
						variant='outline'
						size='icon-sm'
						aria-label='Restart container'
						title='Restart'
						onClick={handleRestart}
						disabled={containerActions.isPending || !isRunning}
					>
						<RotateCcw className='h-3.5 w-3.5' />
					</Button>

					<Button
						variant='outline'
						size='icon-sm'
						aria-label='Open terminal'
						title='Terminal'
						onClick={function () {
							if (onOpenTerminal) {
								onOpenTerminal(container)
							}
						}}
						disabled={!isRunning}
					>
						<TerminalSquare className='h-3.5 w-3.5' />
					</Button>

					<Button
						variant='outline'
						size='icon-sm'
						aria-label='Export compose file'
						title='Export'
						onClick={() => setShowExportDialog(true)}
					>
						<FileCode className='h-3.5 w-3.5' />
					</Button>

					<Button
						variant='outline'
						size='icon-sm'
						aria-label='Remove container'
						title='Remove'
						className='ml-auto text-destructive hover:text-destructive'
						onClick={handleRemove}
						disabled={removeContainer.isPending}
					>
						<Trash2 className='h-3.5 w-3.5' />
					</Button>
				</div>
			</div>

			<div className='flex-1 min-h-0 overflow-y-auto'>
				<div className='p-4 border-b border-border'>
					<ConnectionDetails container={container} />
				</div>

				<div className='p-4 border-b border-border'>
					<ContainerMetrics container={container} />
				</div>

				<div className='p-4'>
					<h4 className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>
						Seed Data
					</h4>
					<SeedView container={container} />
				</div>
			</div>

			<div className='shrink-0 border-t border-border p-3'>
				<Button
					variant='default'
					size='sm'
					className='w-full h-8 gap-1.5'
					onClick={handleOpenInViewer}
					disabled={!isRunning}
				>
					<ExternalLink className='h-3.5 w-3.5' />
					Open in Data Viewer
				</Button>
			</div>

			<ComposeExportDialog
				container={container}
				open={showExportDialog}
				onOpenChange={setShowExportDialog}
			/>

			<RemoveContainerDialog
				containerName={container.name}
				open={showRemoveDialog}
				onOpenChange={setShowRemoveDialog}
				onConfirm={handleConfirmRemove}
				isRemoving={removeContainer.isPending}
			/>
		</div>
	)
}
