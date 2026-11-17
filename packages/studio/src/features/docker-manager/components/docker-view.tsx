import { useActiveNavId } from '@studio/core/workspace-store'
import {
	ArrowDown,
	ArrowUp,
	Check,
	ChevronDown,
	Container,
	Plus,
	RefreshCw,
	RotateCw,
	Search,
	SlidersHorizontal,
	X
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@studio/shared/ui/use-toast'
import { Spinner } from '@studio/shared/ui/spinner'
import { useColorScheme } from '@studio/shared/hooks/use-color-scheme'
import {
	DOCKER_PALETTE_EVENT,
	type DockerPaletteCommand
} from '@studio/features/command-palette/events'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { OfflineIllustration } from '@studio/shared/ui/empty-state-illustrations'
import { useCreateContainer } from '../api/mutations/use-create-container'
import { useContainerActions, useRemoveContainer } from '../api/mutations/use-container-actions'
import {
	useContainers,
	useContainerSearch,
	useDockerAvailability
} from '../api/queries/use-containers'
import type {
	ContainerActionType,
	DatabaseContainerConfig,
	DatabaseProvider,
	DockerContainer,
	RemoveContainerOptions
} from '../types'
import {
	CONTAINER_TEMPLATES,
	POSTGRES_IMAGE,
	MARIADB_IMAGE,
	MYSQL_IMAGE,
	COCKROACH_IMAGE,
	REDIS_IMAGE,
	VALKEY_IMAGE
} from '../constants'
import { getPrimaryDatabasePort } from '../utilities/container-connection'
import { getStatusGroup } from '../utilities/container-status'
import type { StatusGroup } from '../utilities/container-status'
import { ContainerDetailsPanel } from './container-details-panel'
import { ContainerList } from './container-list'
import type { PendingContainer } from './container-list'
import { CreateContainerPanel } from './create-container-panel'
import type { OutputTab } from './output-card'
import { RemoveContainerDialog } from './remove-container-dialog'
import { StatusDot } from './status-dot'
import '../docker-view.css'

type Props = {
	onOpenInDataViewer?: (container: DockerContainer) => void
	windowControls?: ReactNode
}

type StatusFilter = 'all' | StatusGroup
type SortField = 'status' | 'name' | 'port' | 'created'
type SortDirection = 'asc' | 'desc'
type CreatePreset = { provider: DatabaseProvider; version?: string }

const STATUS_FILTER_OPTIONS: ReadonlyArray<{
	value: StatusFilter
	label: string
	tone?: 'ok' | 'off' | 'new'
}> = [
	{ value: 'all', label: 'All' },
	{ value: 'running', label: 'Running', tone: 'ok' },
	{ value: 'stopped', label: 'Stopped', tone: 'off' },
	{ value: 'created', label: 'Created', tone: 'new' }
]

const SORT_OPTIONS: ReadonlyArray<{ value: SortField; label: string }> = [
	{ value: 'status', label: 'Status' },
	{ value: 'name', label: 'Name' },
	{ value: 'port', label: 'Host port' },
	{ value: 'created', label: 'Created' }
]

const STATUS_ORDER: Record<StatusGroup, number> = { running: 0, stopped: 1, created: 2 }

const PROVIDER_LABELS: Record<DatabaseProvider, string> = {
	postgres: 'PostgreSQL',
	mariadb: 'MariaDB',
	mysql: 'MySQL',
	cockroach: 'CockroachDB',
	redis: 'Redis',
	valkey: 'Valkey'
}

const DRAWER_MOTION = {
	initial: { x: '100%' },
	animate: { x: 0, transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] as const } },
	exit: { x: '100%', transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const } }
}

const FADE_MOTION = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: 0.18 } },
	exit: { opacity: 0, transition: { duration: 0.16 } }
}

function toPendingContainer(config: DatabaseContainerConfig): PendingContainer {
	switch (config.provider) {
		case 'redis':
			return {
				name: config.name,
				image: REDIS_IMAGE,
				imageTag: config.redisVersion,
				hostPort: config.hostPort
			}
		case 'valkey':
			return {
				name: config.name,
				image: VALKEY_IMAGE,
				imageTag: config.valkeyVersion,
				hostPort: config.hostPort
			}
		case 'mariadb':
			return {
				name: config.name,
				image: MARIADB_IMAGE,
				imageTag: config.mariadbVersion,
				hostPort: config.hostPort
			}
		case 'mysql':
			return {
				name: config.name,
				image: MYSQL_IMAGE,
				imageTag: config.mysqlVersion,
				hostPort: config.hostPort
			}
		case 'cockroach':
			return {
				name: config.name,
				image: COCKROACH_IMAGE,
				imageTag: config.cockroachVersion,
				hostPort: config.hostPort
			}
		case 'postgres':
			return {
				name: config.name,
				image: POSTGRES_IMAGE,
				imageTag: config.postgresVersion,
				hostPort: config.hostPort
			}
	}
}

function primaryPortOf(container: DockerContainer): number {
	return container.ports.length > 0 ? getPrimaryDatabasePort(container) : Number.MAX_SAFE_INTEGER
}

function compareContainers(a: DockerContainer, b: DockerContainer, sortBy: SortField): number {
	if (sortBy === 'status') {
		return (
			STATUS_ORDER[getStatusGroup(a)] - STATUS_ORDER[getStatusGroup(b)] ||
			(a.name || '').localeCompare(b.name || '')
		)
	}
	if (sortBy === 'port') return primaryPortOf(a) - primaryPortOf(b)
	if (sortBy === 'created') return (b.createdAt || 0) - (a.createdAt || 0)
	return (a.name || '').localeCompare(b.name || '')
}

export function DockerView({ onOpenInDataViewer, windowControls }: Props) {
	const [searchQuery, setSearchQuery] = useState('')
	const [showExternal, setShowExternal] = useState(true)
	const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
	const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
	const [createPreset, setCreatePreset] = useState<CreatePreset>({ provider: 'postgres' })
	const [pendingContainer, setPendingContainer] = useState<PendingContainer | null>(null)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [sortBy, setSortBy] = useState<SortField>('status')
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
	const [outputTab, setOutputTab] = useState<OutputTab>('logs')
	const [showRemoveDialog, setShowRemoveDialog] = useState(false)
	const [containerToRemove, setContainerToRemove] = useState<{
		id: string
		name: string
	} | null>(null)

	const searchInputRef = useRef<HTMLInputElement>(null)
	const isViewActive = useActiveNavId() === 'docker'
	const colorScheme = useColorScheme()
	const reduceMotion = useReducedMotion()
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	const handleSearchFocus = useCallback((event: KeyboardEvent) => {
		const isSlash = event.key === '/' && !event.ctrlKey && !event.metaKey
		const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key === 'k'
		if (!isSlash && !isFindShortcut) return
		const target = event.target
		if (
			target instanceof HTMLElement &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable)
		) {
			return
		}
		event.preventDefault()
		searchInputRef.current?.focus()
	}, [])

	useEffect(
		function bindSearchShortcut() {
			if (!isViewActive) return
			document.addEventListener('keydown', handleSearchFocus)
			return () => document.removeEventListener('keydown', handleSearchFocus)
		},
		[handleSearchFocus, isViewActive]
	)

	const { data: dockerStatus, refetch: refetchDockerAvailability } = useDockerAvailability()
	const {
		data: allContainers = [],
		isLoading: isLoadingContainers,
		isFetching: isFetchingContainers,
		dataUpdatedAt,
		refetch: refetchContainers
	} = useContainers({
		showExternal: true,
		enabled: isViewActive && dockerStatus?.available !== false
	})

	const visibleContainers = useMemo(
		() =>
			showExternal
				? allContainers
				: allContainers.filter((container) => container.origin === 'managed'),
		[showExternal, allContainers]
	)

	const searchedContainers = useContainerSearch(visibleContainers, searchQuery)

	const filteredContainers = useMemo(() => {
		const result =
			statusFilter === 'all'
				? searchedContainers
				: searchedContainers.filter(
						(container) => getStatusGroup(container) === statusFilter
					)
		const direction = sortDirection === 'asc' ? 1 : -1
		return [...result].sort((a, b) => compareContainers(a, b, sortBy) * direction)
	}, [searchedContainers, statusFilter, sortBy, sortDirection])

	const statusCounts = useMemo(() => {
		const counts: Record<StatusFilter, number> = {
			all: visibleContainers.length,
			running: 0,
			stopped: 0,
			created: 0
		}
		for (const container of visibleContainers) counts[getStatusGroup(container)] += 1
		return counts
	}, [visibleContainers])

	const summary = useMemo(
		() => ({
			total: allContainers.length,
			running: allContainers.filter((container) => container.state === 'running').length,
			healthy: allContainers.filter(
				(container) => container.state === 'running' && container.health === 'healthy'
			).length,
			hiddenExternal: showExternal
				? 0
				: allContainers.filter((container) => container.origin === 'external').length
		}),
		[allContainers, showExternal]
	)

	const selectedContainer = useMemo(
		() => filteredContainers.find((container) => container.id === selectedContainerId) ?? null,
		[selectedContainerId, filteredContainers]
	)

	useEffect(
		function selectFirstVisibleContainer() {
			if (selectedContainer || filteredContainers.length === 0) return
			setSelectedContainerId(filteredContainers[0].id)
		},
		[selectedContainer, filteredContainers]
	)

	const visiblePendingContainer = useMemo(() => {
		if (!pendingContainer) return null
		const alreadyListed = allContainers.some(
			(container) => container.name === pendingContainer.name
		)
		return alreadyListed ? null : pendingContainer
	}, [pendingContainer, allContainers])

	const createContainer = useCreateContainer({
		onSuccess: (result, config) => {
			setPendingContainer(null)
			if (result.success && result.containerId) {
				setSelectedContainerId(result.containerId)
				toast({
					title: 'Container created',
					description: `${config ? PROVIDER_LABELS[config.provider] : 'Database'} container is starting up…`,
					variant: 'success'
				})
			} else if (!result.success) {
				toast({
					title: 'Failed to create container',
					description: result.error || 'Unknown error occurred',
					variant: 'destructive'
				})
			}
		},
		onError: (error) => {
			setPendingContainer(null)
			toast({
				title: 'Failed to create container',
				description: error.message,
				variant: 'destructive'
			})
		}
	})

	const containerActions = useContainerActions({
		onSuccess: (result) => {
			if (result.success) return
			toast({
				title: 'Container action failed',
				description: result.error || 'Unknown error occurred',
				variant: 'destructive'
			})
		},
		onError: (error) => {
			toast({
				title: 'Container action failed',
				description: error.message,
				variant: 'destructive'
			})
		}
	})
	const pendingAction =
		containerActions.isPending && containerActions.variables ? containerActions.variables : null

	const removeContainer = useRemoveContainer({
		onSuccess: () => {
			setShowRemoveDialog(false)
			setContainerToRemove(null)
			setSelectedContainerId(null)
		}
	})

	const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (showExternal ? 0 : 1)

	function handleCreateContainer(config: DatabaseContainerConfig) {
		setPendingContainer(toPendingContainer(config))
		setIsCreatePanelOpen(false)
		createContainer.mutate(config)
	}

	function openCreatePanel(preset: CreatePreset) {
		setCreatePreset(preset)
		setIsCreatePanelOpen(true)
	}

	function closeCreatePanel() {
		setIsCreatePanelOpen(false)
	}

	function handleContainerAction(containerId: string, action: ContainerActionType) {
		containerActions.mutate({ containerId, action })
	}

	function handleSelectContainer(id: string) {
		setSelectedContainerId(id)
	}

	function handleRemoveContainer(container: DockerContainer) {
		setContainerToRemove({ id: container.id, name: container.name })
		setShowRemoveDialog(true)
	}

	function handleConfirmRemoveContainer(options: RemoveContainerOptions) {
		if (!containerToRemove) return
		removeContainer.mutate({ containerId: containerToRemove.id, options })
	}

	function handleClearSearch() {
		setSearchQuery('')
		searchInputRef.current?.focus()
	}

	function handleResetFilters() {
		setStatusFilter('all')
		setShowExternal(true)
	}

	async function handleRetryDockerConnection() {
		setSearchQuery('')
		setSelectedContainerId(null)
		setOutputTab('logs')

		queryClient.removeQueries({
			predicate: (query) => {
				const [scope] = query.queryKey
				return typeof scope === 'string' && scope.startsWith('docker-')
			}
		})

		navigate('/', { replace: true })
		await refetchDockerAvailability()
	}

	useEffect(
		function listenForPaletteCommands() {
			function onPaletteCommand(event: Event) {
				if (!(event instanceof CustomEvent)) return
				const detail: DockerPaletteCommand | undefined = event.detail
				if (!detail) return

				if (detail.type === 'open-create') {
					setIsCreatePanelOpen(true)
					return
				}

				setSelectedContainerId(detail.containerId)

				if (detail.type === 'select-container') return

				if (detail.type === 'container-action') {
					containerActions.mutate({
						containerId: detail.containerId,
						action: detail.action
					})
					return
				}

				const container = allContainers.find((item) => item.id === detail.containerId)
				if (!container) return

				if (detail.type === 'open-in-data-viewer') {
					onOpenInDataViewer?.(container)
					return
				}

				if (detail.type === 'open-terminal') setOutputTab('shell')
			}

			window.addEventListener(DOCKER_PALETTE_EVENT, onPaletteCommand)
			return () => window.removeEventListener(DOCKER_PALETTE_EVENT, onPaletteCommand)
		},
		[allContainers, containerActions, onOpenInDataViewer]
	)

	if (dockerStatus && !dockerStatus.available) {
		const error = dockerStatus.error?.toLowerCase() ?? ''
		const showDaemonHint =
			!dockerStatus.error ||
			error.includes('permission') ||
			error.includes('connect') ||
			error.includes('socket')
		return (
			<EmptyState
				className='flex-1'
				loop
				illustration={<OfflineIllustration />}
				title='Docker not available'
				description={
					dockerStatus.error ||
					'Unable to connect to Docker. Make sure Docker is installed and running on your system.'
				}
				actions={[
					{
						id: 'retry',
						label: 'Retry',
						icon: <RotateCw />,
						variant: 'secondary',
						onClick: handleRetryDockerConnection
					}
				]}
			>
				{showDaemonHint && (
					<div className='order-first w-full max-w-sm space-y-1 rounded-md border border-border/50 bg-muted/15 px-3 py-2 text-left font-mono text-xs text-muted-foreground'>
						<p>$ sudo systemctl start docker</p>
						<p>$ sudo usermod -aG docker $USER</p>
					</div>
				)}
			</EmptyState>
		)
	}

	return (
		<div className='dk' data-scheme={colorScheme}>
			<header className='dk-hd' data-tauri-drag-region='true'>
				<Container className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' />
				<h1>Docker</h1>
				<span className='dk-sum dk-mono'>
					<b>{summary.total}</b> {summary.total === 1 ? 'container' : 'containers'} ·{' '}
					<b>{summary.running}</b> running · <b>{summary.healthy}</b> healthy
					{summary.hiddenExternal > 0 && ` · ${summary.hiddenExternal} external hidden`}
				</span>

				<div className='dk-hd-r' data-tauri-drag-region='false'>
					<button
						type='button'
						className='dk-ibtn'
						onClick={() => void refetchContainers()}
						disabled={isFetchingContainers}
						aria-label='Refresh'
						title='Refresh'
					>
						{isFetchingContainers ? (
							<Spinner className='h-3.5 w-3.5' />
						) : (
							<RefreshCw className='h-3.5 w-3.5' aria-hidden='true' />
						)}
					</button>

					<div className='dk-split'>
						<button
							type='button'
							className='dk-btn'
							data-variant='primary'
							onClick={() => openCreatePanel({ provider: 'postgres' })}
						>
							<Plus className='h-3.5 w-3.5' aria-hidden='true' />
							New container
						</button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type='button'
									className='dk-btn'
									data-variant='primary'
									aria-label='Container templates'
								>
									<ChevronDown className='h-3.5 w-3.5' aria-hidden='true' />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' className='dk-menu'>
								<DropdownMenuLabel className='dk-eyebrow'>
									Quick start
								</DropdownMenuLabel>
								{CONTAINER_TEMPLATES.map((template) => (
									<DropdownMenuItem
										key={template.id}
										onSelect={() =>
											openCreatePanel({
												provider: template.provider,
												version: template.version
											})
										}
									>
										<span className='flex flex-col'>
											{template.title}
											<span className='dk-menu-s dk-mono'>
												{template.image}
											</span>
										</span>
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={() => openCreatePanel({ provider: 'postgres' })}
								>
									<Plus className='mr-2 h-3.5 w-3.5' aria-hidden='true' />
									Custom container
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{windowControls}
				</div>
			</header>

			<div className='dk-body'>
				<section className='dk-lc' aria-label='Containers'>
					<div className='dk-lc-tb'>
						<label className='dk-search'>
							<Search className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
							<input
								id='container-search'
								ref={searchInputRef}
								type='search'
								placeholder='Search name, image or port'
								name='container_search'
								autoComplete='off'
								spellCheck={false}
								aria-label='Search containers'
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
							/>
							<kbd>/</kbd>
						</label>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button type='button' className='dk-fbtn'>
									<SlidersHorizontal className='h-3.5 w-3.5' aria-hidden='true' />
									View
									{activeFilterCount > 0 && (
										<span className='dk-count'>{activeFilterCount}</span>
									)}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' className='dk-menu'>
								<DropdownMenuLabel className='dk-eyebrow'>Status</DropdownMenuLabel>
								{STATUS_FILTER_OPTIONS.map((option) => (
									<DropdownMenuItem
										key={option.value}
										onSelect={() => setStatusFilter(option.value)}
									>
										<span className='dk-menu-row'>
											{option.tone ? (
												<StatusDot tone={option.tone} />
											) : (
												<span className='w-[7px]' />
											)}
											{option.label}
											<span className='dk-menu-x'>
												{statusCounts[option.value]}
											</span>
											<Check
												className='h-3.5 w-3.5'
												style={{
													opacity: statusFilter === option.value ? 1 : 0
												}}
												aria-hidden='true'
											/>
										</span>
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuLabel className='dk-eyebrow flex items-center'>
									Sort by
									<button
										type='button'
										className='dk-dirbtn'
										onClick={() =>
											setSortDirection((current) =>
												current === 'asc' ? 'desc' : 'asc'
											)
										}
										aria-label={
											sortDirection === 'asc'
												? 'Sorting ascending. Activate to sort descending'
												: 'Sorting descending. Activate to sort ascending'
										}
									>
										{sortDirection === 'asc' ? (
											<ArrowUp className='h-3 w-3' aria-hidden='true' />
										) : (
											<ArrowDown className='h-3 w-3' aria-hidden='true' />
										)}
										{sortDirection === 'asc' ? 'Asc' : 'Desc'}
									</button>
								</DropdownMenuLabel>
								{SORT_OPTIONS.map((option) => (
									<DropdownMenuItem
										key={option.value}
										onSelect={() => setSortBy(option.value)}
									>
										<span className='dk-menu-row'>
											{option.label}
											<Check
												className='ml-auto h-3.5 w-3.5'
												style={{ opacity: sortBy === option.value ? 1 : 0 }}
												aria-hidden='true'
											/>
										</span>
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={(event) => {
										event.preventDefault()
										setShowExternal((value) => !value)
									}}
								>
									<span className='dk-menu-row'>
										<span className='flex flex-col'>
											Show external
											<span className='dk-menu-s'>
												Containers not created by Dora
											</span>
										</span>
										<Check
											className='ml-auto h-3.5 w-3.5'
											style={{ opacity: showExternal ? 1 : 0 }}
											aria-hidden='true'
										/>
									</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{activeFilterCount > 0 && (
						<div className='dk-chips'>
							{statusFilter !== 'all' && (
								<button
									type='button'
									className='dk-chip'
									onClick={() => setStatusFilter('all')}
									aria-label={`Clear ${statusFilter} filter`}
								>
									{
										STATUS_FILTER_OPTIONS.find(
											(option) => option.value === statusFilter
										)?.label
									}
									<X className='h-3 w-3' aria-hidden='true' />
								</button>
							)}
							{!showExternal && (
								<button
									type='button'
									className='dk-chip'
									onClick={() => setShowExternal(true)}
									aria-label='Show external containers'
								>
									External hidden
									<X className='h-3 w-3' aria-hidden='true' />
								</button>
							)}
						</div>
					)}

					<div className='dk-lh dk-eyebrow' aria-hidden='true'>
						<span />
						<span>Container</span>
						<span>Port</span>
						<span>Age</span>
					</div>

					<ContainerList
						containers={filteredContainers}
						selectedContainerId={selectedContainer?.id ?? null}
						onSelectContainer={handleSelectContainer}
						pendingAction={pendingAction}
						isLoading={isLoadingContainers}
						searchQuery={searchQuery}
						onClearSearch={handleClearSearch}
						onResetFilters={handleResetFilters}
						hasActiveFilters={statusFilter !== 'all' || !showExternal}
						groupByStatus={sortBy === 'status'}
						pendingContainer={visiblePendingContainer}
					/>
				</section>

				<section className='dk-dc' aria-label='Container details'>
					<ContainerDetailsPanel
						container={selectedContainer}
						pendingAction={
							pendingAction && pendingAction.containerId === selectedContainer?.id
								? pendingAction.action
								: null
						}
						onAction={handleContainerAction}
						onRemove={handleRemoveContainer}
						onOpenInDataViewer={onOpenInDataViewer}
						outputTab={outputTab}
						onOutputTabChange={setOutputTab}
					/>
				</section>
			</div>

			<footer className='dk-sbar dk-mono'>
				<span className='dk-sbar-l'>
					<StatusDot tone={dockerStatus?.available ? 'ok' : 'off'} />
					{dockerStatus?.version ? `Docker ${dockerStatus.version}` : 'Docker engine'}
				</span>
				{dataUpdatedAt > 0 && (
					<span className='dk-sbar-r'>
						Synced {new Date(dataUpdatedAt).toTimeString().slice(0, 8)}
					</span>
				)}
			</footer>

			<AnimatePresence>
				{isCreatePanelOpen && (
					<motion.div
						key='scrim'
						className='dk-scrim'
						onClick={closeCreatePanel}
						{...FADE_MOTION}
					/>
				)}
				{isCreatePanelOpen && (
					<motion.aside
						key='drawer'
						className='dk-drawer'
						role='dialog'
						aria-modal='true'
						aria-labelledby='dk-create-title'
						{...(reduceMotion ? FADE_MOTION : DRAWER_MOTION)}
					>
						<CreateContainerPanel
							key={`${createPreset.provider}-${createPreset.version ?? ''}`}
							onClose={closeCreatePanel}
							onSubmit={handleCreateContainer}
							existingContainers={allContainers}
							isSubmitting={createContainer.isPending}
							initialProvider={createPreset.provider}
							initialVersion={createPreset.version}
						/>
					</motion.aside>
				)}
			</AnimatePresence>

			<RemoveContainerDialog
				containerName={containerToRemove?.name ?? ''}
				open={showRemoveDialog}
				onOpenChange={(open) => {
					setShowRemoveDialog(open)
					if (!open) setContainerToRemove(null)
				}}
				onConfirm={handleConfirmRemoveContainer}
				isRemoving={removeContainer.isPending}
			/>
		</div>
	)
}
