import {
	Plus,
	Search,
	Container,
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Activity,
	HeartPulse,
	TerminalSquare,
	X
} from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useCreateContainer } from '../api/mutations/use-create-container'
import { useContainerActions } from '../api/mutations/use-container-actions'
import {
	useContainers,
	useContainerSearch,
	useDockerAvailability
} from '../api/queries/use-containers'
import type { PostgresContainerConfig, DockerContainer } from '../types'
import { ContainerDetailsPanel } from './container-details-panel'
import { ContainerList } from './container-list'
import { ContainerTerminal } from './container-terminal'
import { CreateContainerDialog } from './create-container-dialog'
import { SandboxIndicator } from './sandbox-indicator'
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

type StatusFilter = 'all' | 'running' | 'stopped' | 'created'
type SortField = 'name' | 'created' | 'status'
type SortDirection = 'asc' | 'desc'

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'running', label: 'Running' },
	{ value: 'stopped', label: 'Stopped' },
	{ value: 'created', label: 'Created' }
]

export function DockerView({ onOpenInDataViewer }: Props) {
	const [searchQuery, setSearchQuery] = useState('')
	const [showExternal, setShowExternal] = useState(false)
	const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [sortBy, setSortBy] = useState<SortField>('name')
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
	const [terminalContainerId, setTerminalContainerId] = useState<string | null>(null)
	const [isTerminalPanelOpen, setIsTerminalPanelOpen] = useState(false)

	const searchInputRef = useRef<HTMLInputElement>(null)
	const { toast } = useToast()

	const handleSearchFocus = useCallback(function (e: KeyboardEvent) {
		if (
			(e.key === '/' && !e.ctrlKey && !e.metaKey) ||
			((e.ctrlKey || e.metaKey) && e.key === 'k')
		) {
			const target = e.target as HTMLElement
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
				return
			}
			e.preventDefault()
			searchInputRef.current?.focus()
		}
	}, [])

	useEffect(function () {
		document.addEventListener('keydown', handleSearchFocus)
		return function () {
			document.removeEventListener('keydown', handleSearchFocus)
		}
	}, [handleSearchFocus])

	const { data: dockerStatus, isLoading: isCheckingDocker } = useDockerAvailability()
	const { data: allContainers = [], isLoading: isLoadingContainers } = useContainers({
		showExternal: true,
		enabled: dockerStatus?.available ?? false
	})

	const visibleContainers = useMemo(function () {
		if (showExternal) {
			return allContainers
		}

		return allContainers.filter(function (container) {
			return container.origin === 'managed'
		})
	}, [showExternal, allContainers])

	const externalCount = useMemo(function () {
		if (showExternal) return 0

		return allContainers.filter(function (container) {
			return container.origin === 'external'
		}).length
	}, [showExternal, allContainers])
	const searchedContainers = useContainerSearch(visibleContainers, searchQuery)

	const filteredContainers = useMemo(
		function () {
			let result = searchedContainers

			// Filter by status
			if (statusFilter !== 'all') {
				result = result.filter(function (c) {
					if (statusFilter === 'running') return c.state === 'running'
					if (statusFilter === 'stopped') return c.state === 'exited' || c.state === 'dead'
					if (statusFilter === 'created') return c.state === 'created'
					return true
				})
			}

			// Sort
			return [...result].sort(function (a, b) {
				let sortResult = 0

				if (sortBy === 'name') {
					const nameA = a.name || ''
					const nameB = b.name || ''
					sortResult = nameA.localeCompare(nameB)
				}
				if (sortBy === 'created') {
					const createdA = a.createdAt || 0
					const createdB = b.createdAt || 0
					sortResult = createdA - createdB
				}
				if (sortBy === 'status') {
					sortResult = a.state.localeCompare(b.state)
				}

				return sortDirection === 'asc' ? sortResult : sortResult * -1
			})
		},
		[searchedContainers, statusFilter, sortBy, sortDirection]
	)

	const selectedContainer = useMemo(
		function () {
			if (!selectedContainerId) {
				return null
			}
			return (
				visibleContainers.find(function (c) {
					return c.id === selectedContainerId
				}) ?? null
			)
		},
		[selectedContainerId, visibleContainers]
	)
	const terminalContainer = useMemo(
		function () {
			if (!terminalContainerId) {
				return null
			}
			return (
				allContainers.find(function (container) {
					return container.id === terminalContainerId
				}) ?? null
			)
		},
		[allContainers, terminalContainerId]
	)

	const containerSummary = useMemo(function () {
		const runningCount = visibleContainers.filter(function (container) {
			return container.state === 'running'
		}).length

		const healthyCount = visibleContainers.filter(function (container) {
			return container.state === 'running' && container.health === 'healthy'
		}).length

		return {
			total: visibleContainers.length,
			running: runningCount,
			healthy: healthyCount
		}
	}, [visibleContainers])

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

	const containerActions = useContainerActions()

	function handleCreateContainer(config: PostgresContainerConfig) {
		createContainer.mutate(config)
	}

	function handleQuickStart(id: string) {
		containerActions.mutate({ containerId: id, action: 'start' })
	}

	function handleQuickStop(id: string) {
		containerActions.mutate({ containerId: id, action: 'stop' })
	}

	function handleQuickRestart(id: string) {
		containerActions.mutate({ containerId: id, action: 'restart' })
	}

	function handleOpenContainerInDataViewer(container: DockerContainer) {
		setSelectedContainerId(container.id)
		if (onOpenInDataViewer) {
			onOpenInDataViewer(container)
		}
	}

	function handleSelectContainer(id: string) {
		setSelectedContainerId(id)
	}

	function handleOpenTerminal(container: DockerContainer) {
		setSelectedContainerId(container.id)
		setTerminalContainerId(container.id)
		setIsTerminalPanelOpen(true)
	}

	function handleCloseTerminalPanel() {
		setIsTerminalPanelOpen(false)
	}

	function handleRemoveComplete() {
		setSelectedContainerId(null)
	}

	function handleClearSearch() {
		setSearchQuery('')
		searchInputRef.current?.focus()
	}

	useEffect(
		function keepTerminalContainerInSync() {
			if (!terminalContainerId) {
				return
			}

			const stillExists = allContainers.some(function (container) {
				return container.id === terminalContainerId
			})
			if (!stillExists) {
				setTerminalContainerId(null)
				setIsTerminalPanelOpen(false)
			}
		},
		[allContainers, terminalContainerId]
	)

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
			<header className='border-b border-border bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10'>
				<div className='flex items-center justify-between px-4 py-3'>
					<div className='flex min-w-0 items-center gap-3'>
						<div className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10'>
							<Container className='h-5 w-5 text-emerald-500' />
						</div>
						<div className='min-w-0'>
							<h1 className='text-lg font-semibold'>Docker Containers</h1>
							<p className='text-xs text-muted-foreground'>
								Local PostgreSQL containers with one-click controls.
							</p>
						</div>
					</div>
					<SandboxIndicator />
				</div>

				<div className='px-4 pb-3'>
					<div className='flex flex-wrap items-center gap-2'>
						<StatPill
							label='Visible'
							value={containerSummary.total}
							icon={<Container className='h-3.5 w-3.5' aria-hidden='true' />}
						/>
						<StatPill
							label='Running'
							value={containerSummary.running}
							icon={<Activity className='h-3.5 w-3.5' aria-hidden='true' />}
						/>
						<StatPill
							label='Healthy'
							value={containerSummary.healthy}
							icon={<HeartPulse className='h-3.5 w-3.5' aria-hidden='true' />}
						/>
					</div>
				</div>
			</header>

			<div className='flex flex-wrap items-center gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
				<div className='relative flex-1 max-w-sm'>
					<Label htmlFor='container-search' className='sr-only'>
						Search containers
					</Label>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
					<Input
						id='container-search'
						ref={searchInputRef}
						placeholder='Search containers...'
						name='container_search'
						autoComplete='off'
						value={searchQuery}
						onChange={function (e) {
							setSearchQuery(e.target.value)
						}}
						className='pl-9 pr-12'
					/>
					<kbd className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground'>
						/
					</kbd>
				</div>

				<div className='flex items-center gap-2'>
					<Switch
						id='show-external'
						checked={showExternal}
						onCheckedChange={setShowExternal}
					/>
					<Label htmlFor='show-external' className='text-sm whitespace-nowrap'>
						Show all
						{!showExternal && externalCount > 0 && (
							<span className='ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-[10px] font-medium text-muted-foreground tabular-nums'>
								+{externalCount}
							</span>
						)}
					</Label>
				</div>

				<div className='h-4 w-px bg-border mx-2' />

				<div className='flex min-w-0 flex-1 items-center gap-2'>
					<div
						className='flex items-center gap-1 overflow-x-auto pb-1'
						role='toolbar'
						aria-label='Filter containers by status'
					>
						{STATUS_FILTER_OPTIONS.map(function (option) {
							const isActive = option.value === statusFilter

							return (
								<button
									key={option.value}
									type='button'
									aria-pressed={isActive}
									onClick={function () {
										setStatusFilter(option.value)
									}}
									className={cn(
										'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
										'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
										isActive
											? 'border-transparent bg-primary text-primary-foreground shadow-sm'
											: 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
									)}
								>
									{option.label}
								</button>
							)
						})}
					</div>

					<Select
						value={sortBy}
						onValueChange={function (value) {
							setSortBy(value as SortField)
						}}
					>
						<SelectTrigger aria-label='Sort containers' className='w-[130px] h-7 text-xs'>
							<SelectValue placeholder='Sort by' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='name'>Name</SelectItem>
							<SelectItem value='created'>Created</SelectItem>
							<SelectItem value='status'>Status</SelectItem>
						</SelectContent>
					</Select>

					<Button
						type='button'
						size='icon-sm'
						variant='outline'
						onClick={function () {
							setSortDirection(function (current) {
								return current === 'asc' ? 'desc' : 'asc'
							})
						}}
						aria-label={
							sortDirection === 'asc'
								? 'Sorting ascending. Activate to sort descending'
								: 'Sorting descending. Activate to sort ascending'
						}
					>
						{sortDirection === 'asc' ? (
							<ArrowUp className='h-3.5 w-3.5' aria-hidden='true' />
						) : (
							<ArrowDown className='h-3.5 w-3.5' aria-hidden='true' />
						)}
					</Button>
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

			<div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
				<div className='flex-1 min-h-0 flex overflow-hidden'>
					<ContainerList
						containers={filteredContainers}
						selectedContainerId={selectedContainerId}
						onSelectContainer={handleSelectContainer}
						onStartContainer={handleQuickStart}
						onStopContainer={handleQuickStop}
						onRestartContainer={handleQuickRestart}
						onOpenContainerInDataViewer={handleOpenContainerInDataViewer}
						isActionPending={containerActions.isPending}
						isLoading={isLoadingContainers}
						searchQuery={searchQuery}
						onClearSearch={handleClearSearch}
					/>

					<ContainerDetailsPanel
						container={selectedContainer}
						onOpenInDataViewer={onOpenInDataViewer}
						onOpenTerminal={handleOpenTerminal}
						onRemoveComplete={handleRemoveComplete}
					/>
				</div>

				{isTerminalPanelOpen && terminalContainer && (
					<div className='h-72 border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70'>
						<div className='h-9 border-b border-border px-3 flex items-center justify-between'>
							<div className='flex items-center gap-2 min-w-0'>
								<TerminalSquare className='h-4 w-4 text-muted-foreground' />
								<span className='text-sm font-medium'>Terminal</span>
								<span className='text-xs text-muted-foreground truncate'>
									{terminalContainer.name}
								</span>
							</div>
							<Button
								type='button'
								size='icon-sm'
								variant='ghost'
								onClick={handleCloseTerminalPanel}
								aria-label='Close terminal panel'
							>
								<X className='h-4 w-4' />
							</Button>
						</div>
						<div className='h-[calc(100%-2.25rem)] p-3'>
							<ContainerTerminal container={terminalContainer} enabled={isTerminalPanelOpen} />
						</div>
					</div>
				)}
			</div>

			<CreateContainerDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onSubmit={handleCreateContainer}
				existingContainers={allContainers}
				isSubmitting={createContainer.isPending}
			/>
		</div>
	)
}

function StatPill({
	icon,
	label,
	value
}: {
	icon: ReactNode
	label: string
	value: number
}) {
	return (
		<div className='inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs'>
			<span className='text-muted-foreground'>{icon}</span>
			<span className='text-muted-foreground'>{label}</span>
			<span className='font-semibold tabular-nums text-foreground'>{value}</span>
		</div>
	)
}
