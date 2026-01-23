import { Play, Square, RotateCcw, Trash2, ExternalLink } from "lucide-react";
import { Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useContainerActions, useRemoveContainer } from "../api/mutations/use-container-actions";
import { useContainerLogs } from "../api/queries/use-container-logs";
import { DEFAULT_LOG_TAIL } from "../constants";
import type { DockerContainer } from "../types";
import { ConnectionDetails } from "./connection-details";
import { LogsViewer } from "./logs-viewer";
import { StatusBadge } from "./status-badge";

type Props = {
	container: DockerContainer | null
	onOpenInDataViewer?: (container: DockerContainer) => void
	onRemoveComplete?: () => void
}

export function ContainerDetailsPanel({ container, onOpenInDataViewer, onRemoveComplete }: Props) {
	const [tailLines, setTailLines] = useState(DEFAULT_LOG_TAIL)
	const [activeTab, setActiveTab] = useState('logs')

	const {
		data: logs,
		isLoading: logsLoading
	} = useContainerLogs(container?.id ?? null, { tail: tailLines, enabled: activeTab === 'logs' })

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

	const isRunning = container.state === 'running'

	const passwordEnv = container.env.find((e) => e.startsWith('POSTGRES_PASSWORD='))
	const password = passwordEnv
		? passwordEnv.split('=')[1]
		: (container.labels['POSTGRES_PASSWORD'] || 'postgres')

	function handleStart() {
		containerActions.mutate({ containerId: container.id, action: 'start' })
	}

	function handleStop() {
		containerActions.mutate({ containerId: container.id, action: 'stop' })
	}

	function handleRestart() {
		containerActions.mutate({ containerId: container.id, action: 'restart' })
	}

	function handleRemove() {
		if (confirm(`Are you sure you want to remove "${container.name}"?`)) {
			removeContainer.mutate({
				containerId: container.id,
				options: { force: true, removeVolumes: false }
			})
		}
	}

	function handleOpenInViewer() {
		if (onOpenInDataViewer) {
			onOpenInDataViewer(container)
		}
	}



	return (
		<div className='w-80 flex flex-col border-l border-border bg-card'>
			<div className='p-4 border-b border-border'>
				<div className='flex items-start justify-between gap-2'>
					<div className='min-w-0'>
						<h3 className='font-medium text-sm truncate'>{container.name}</h3>
						<div className='mt-1 text-xs text-muted-foreground'>
							{container.image}:{container.imageTag}
						</div>
					</div>
					<StatusBadge state={container.state} health={container.health} />
				</div>
			</div>

			<div className='p-4 border-b border-border'>
				<ConnectionDetails container={container} password={password} />
			</div>

			<div className='p-4 border-b border-border space-y-2'>
				<h4 className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>
					Actions
				</h4>

				<div className='flex flex-wrap gap-2'>
					{!isRunning ? (
						<Button
							variant='outline'
							size='sm'
							className='h-8 gap-1.5'
							onClick={handleStart}
							disabled={containerActions.isPending}
						>
							<Play className='h-3.5 w-3.5' />
							Start
						</Button>
					) : (
						<Button
							variant='outline'
							size='sm'
							className='h-8 gap-1.5'
							onClick={handleStop}
							disabled={containerActions.isPending}
						>
							<Square className='h-3.5 w-3.5' />
							Stop
						</Button>
					)}

					<Button
						variant='outline'
						size='sm'
						className='h-8 gap-1.5'
						onClick={handleRestart}
						disabled={containerActions.isPending || !isRunning}
					>
						<RotateCcw className='h-3.5 w-3.5' />
						Restart
					</Button>

					<Button
						variant='outline'
						size='sm'
						className='h-8 gap-1.5 text-destructive hover:text-destructive'
						onClick={handleRemove}
						disabled={removeContainer.isPending}
					>
						<Trash2 className='h-3.5 w-3.5' />
						Remove
					</Button>
				</div>

				<Button
					variant='default'
					size='sm'
					className='w-full h-8 gap-1.5 mt-3'
					onClick={handleOpenInViewer}
					disabled={!isRunning}
				>
					<ExternalLink className='h-3.5 w-3.5' />
					Open in Data Viewer
				</Button>
			</div>

			<div className='flex-1 flex flex-col min-h-0 p-4'>
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className='flex-1 flex flex-col'
				>
					<TabsList className='w-full'>
						<TabsTrigger value='logs' className='flex-1'>
							Logs
						</TabsTrigger>
						<TabsTrigger value='seed' className='flex-1'>
							Seed
						</TabsTrigger>
					</TabsList>

					<TabsContent value='logs' className='flex-1 mt-3'>
						<LogsViewer
							logs={logs || ''}
							isLoading={logsLoading}
							tailLines={tailLines}
							onTailLinesChange={setTailLines}
						/>
					</TabsContent>

					<TabsContent value='seed' className='flex-1 mt-3'>
						<div className='text-center py-8 text-muted-foreground'>
							<p className='text-sm'>Seed functionality coming soon</p>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}
