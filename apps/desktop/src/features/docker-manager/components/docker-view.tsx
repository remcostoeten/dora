import { Plus, Search, Container, AlertTriangle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useCreateContainer } from '../api/mutations/use-create-container'
import {
	useContainers,
	useContainerSearch,
	useDockerAvailability
} from '../api/queries/use-containers'
import type { PostgresContainerConfig, DockerContainer } from '../types'
import { ContainerDetailsPanel } from './container-details-panel'
import { ContainerList } from './container-list'
import { CreateContainerDialog } from './create-container-dialog'
import { SandboxIndicator } from './sandbox-indicator'
import { Badge } from '@/shared/ui/badge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/shared/ui/select'
import { cn } from '@/shared/utils/cn'

type Props = {
	onOpenInDataViewer?: (container: DockerContainer) => void
}

export function DockerView({ onOpenInDataViewer }: Props) {
	const [searchQuery, setSearchQuery] = useState('')
	const [showExternal, setShowExternal] = useState(false)
	const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'created'>('all')
	const [sortBy, setSortBy] = useState<'name' | 'created' | 'status'>('name')

	const { toast } = useToast()

	const { data: dockerStatus, isLoading: isCheckingDocker } = useDockerAvailability()
	const { data: containers, isLoading: isLoadingContainers } = useContainers({
		showExternal,
		enabled: dockerStatus?.available ?? false
	})

	const searchedContainers = useContainerSearch(containers, searchQuery)

	const filteredContainers = useMemo(
		function () {
			let result = searchedContainers

			// Filter by status
			if (statusFilter !== 'all') {
				result = result.filter(function (c) {
					if (statusFilter === 'running') return c.state === 'running'
					if (statusFilter === 'stopped') return c.state === 'exited'
					if (statusFilter === 'created') return c.state === 'created'
					return true
				})
			}

			// Sort
			return [...result].sort(function (a, b) {
				if (sortBy === 'name') {
					return a.names[0].localeCompare(b.names[0])
				}
				if (sortBy === 'created') {
					return b.created - a.created // Newest first
				}
				if (sortBy === 'status') {
					return a.state.localeCompare(b.state)
				}
				return 0
			})
		},
		[searchedContainers, statusFilter, sortBy]
	)

	const selectedContainer = useMemo(
		function () {
			if (!selectedContainerId || !containers) {
				return null
			}
			return (
				containers.find(function (c) {
					return c.id === selectedContainerId
				}) ?? null
			)
		},
		[selectedContainerId, containers]
	)

	const createContainer = useCreateContainer({
		onSuccess: function (result) {
			if (result.success && result.containerId) {
				setIsCreateDialogOpen(false)
				setSelectedContainerId(result.containerId)
				toast({
					title: 'Container Created',
					description: 'PostgreSQL container is starting up...'
				})
			} else if (!result.success) {
				toast({
					title: 'Failed to Create Container',
					description: result.error || 'Unknown error occurred',
					variant: 'destructive'
				})
			}
		},
		onError: function (error) {
			toast({
				title: 'Failed to Create Container',
				description: error.message,
				variant: 'destructive'
			})
		}
	})

	function handleCreateContainer(config: PostgresContainerConfig) {
		createContainer.mutate(config)
	}

	function handleSelectContainer(id: string) {
		setSelectedContainerId(id)
	}

	function handleRemoveComplete() {
		setSelectedContainerId(null)
	}

	if (isCheckingDocker) {
		return (
			<div className='flex-1 flex items-center justify-center'>
				<div className='text-center'>
					<div className='h-10 w-10 mx-auto mb-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin' />
					<p className='text-sm text-muted-foreground'>Checking Docker status...</p>
				</div>
			</div>
		)
	}

	if (!dockerStatus?.available) {
		return (
			<div className='flex-1 flex items-center justify-center p-8'>
				<div className='text-center max-w-md'>
					<AlertTriangle className='h-12 w-12 mx-auto mb-4 text-yellow-500' />
					<h2 className='text-lg font-semibold mb-2'>Docker Not Available</h2>
					<p className='text-sm text-muted-foreground mb-4'>
						{dockerStatus?.error ||
							'Unable to connect to Docker. Make sure Docker is installed and running on your system.'}
					</p>
					{(dockerStatus?.error?.toLowerCase().includes('permission') ||
						dockerStatus?.error?.toLowerCase().includes('connect') ||
						dockerStatus?.error?.toLowerCase().includes('socket') ||
						!dockerStatus?.error) && (
							<div className='text-left p-3 rounded bg-muted font-mono text-xs space-y-1'>
								<p>$ sudo systemctl start docker</p>
								<p>$ sudo usermod -aG docker $USER</p>
							</div>
						)}
					<Button
						variant='outline'
						className='mt-4'
						onClick={function () {
							window.location.reload()
						}}
					>
						Retry
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className='flex-1 flex flex-col h-full overflow-hidden'>
			<header className='flex items-center justify-between px-4 py-3 border-b border-border'>
				<div className='flex items-center gap-3'>
					<Container className='h-5 w-5 text-muted-foreground' />
					<h1 className='text-lg font-semibold'>Docker Containers</h1>
				</div>
				<SandboxIndicator />
			</header>

			<div className='flex items-center gap-3 px-4 py-3 border-b border-border'>
				<div className='relative flex-1 max-w-sm'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
					<Input
						placeholder='Search containers...'
						value={searchQuery}
						onChange={function (e) {
							setSearchQuery(e.target.value)
						}}
						className='pl-9'
					/>
				</div>

				<div className='flex items-center gap-2'>
					<Switch
						id='show-external'
						checked={showExternal}
						onCheckedChange={setShowExternal}
					/>
					<Label htmlFor='show-external' className='text-sm'>
						Show all
					</Label>
				</div>

				<div className='h-4 w-px bg-border mx-2' />

				<div className='flex items-center gap-2'>
					<div className='flex gap-1'>
						{(['all', 'running', 'stopped'] as const).map((status) => (
							<Badge
								key={status}
								variant={statusFilter === status ? 'default' : 'outline'}
								className={cn(
									'cursor-pointer capitalize',
									statusFilter !== status && 'hover:bg-muted'
								)}
								onClick={() => setStatusFilter(status)}
							>
								{status}
							</Badge>
						))}
					</div>

					<Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
						<SelectTrigger className='w-[120px] h-7 text-xs'>
							<SelectValue placeholder='Sort by' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='name'>Name</SelectItem>
							<SelectItem value='created'>Created</SelectItem>
							<SelectItem value='status'>Status</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Button
					size='sm'
					className='gap-1.5'
					onClick={function () {
						setIsCreateDialogOpen(true)
					}}
				>
					<Plus className='h-4 w-4' />
					New Container
				</Button>
			</div>

			<div className='flex-1 flex overflow-hidden'>
				<ContainerList
					containers={filteredContainers}
					selectedContainerId={selectedContainerId}
					onSelectContainer={handleSelectContainer}
					isLoading={isLoadingContainers}
				/>

				<ContainerDetailsPanel
					container={selectedContainer}
					onOpenInDataViewer={onOpenInDataViewer}
					onRemoveComplete={handleRemoveComplete}
				/>
			</div>

			<CreateContainerDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onSubmit={handleCreateContainer}
				existingContainers={containers || []}
				isSubmitting={createContainer.isPending}
			/>
		</div >
	)
}
