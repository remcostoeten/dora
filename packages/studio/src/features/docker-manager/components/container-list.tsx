import { Container } from 'lucide-react'
import { Fragment, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack, SearchIllustration } from '@studio/shared/ui/empty-state-illustrations'
import type { ContainerActionType, DockerContainer } from '../types'
import { getPrimaryDatabasePort } from '../utilities/container-connection'
import {
	formatImage,
	formatShortAge,
	getContainerStatus,
	getStatusGroup
} from '../utilities/container-status'
import type { StatusGroup } from '../utilities/container-status'
import { StatusDot } from './status-dot'

export type PendingContainer = {
	name: string
	image: string
	imageTag: string
	hostPort: number
}

type Props = {
	containers: DockerContainer[]
	selectedContainerId: string | null
	onSelectContainer: (id: string) => void
	pendingAction?: { containerId: string; action: ContainerActionType } | null
	isLoading?: boolean
	searchQuery?: string
	onClearSearch?: () => void
	onResetFilters?: () => void
	hasActiveFilters?: boolean
	groupByStatus?: boolean
	pendingContainer?: PendingContainer | null
}

const GROUP_LABELS: Record<StatusGroup, string> = {
	running: 'Running',
	stopped: 'Stopped',
	created: 'Created'
}

function highlight(text: string, query: string): ReactNode {
	const needle = query.trim().toLowerCase()
	if (!needle) return text
	const index = text.toLowerCase().indexOf(needle)
	if (index < 0) return text
	return (
		<>
			{text.slice(0, index)}
			<mark>{text.slice(index, index + needle.length)}</mark>
			{text.slice(index + needle.length)}
		</>
	)
}

export function ContainerList({
	containers,
	selectedContainerId,
	onSelectContainer,
	pendingAction = null,
	isLoading = false,
	searchQuery = '',
	onClearSearch,
	onResetFilters,
	hasActiveFilters = false,
	groupByStatus = false,
	pendingContainer = null
}: Props) {
	const listRef = useRef<HTMLDivElement>(null)

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
		if (containers.length === 0) return
		event.preventDefault()

		const currentIndex = containers.findIndex((item) => item.id === selectedContainerId)
		const step = event.key === 'ArrowDown' ? 1 : -1
		const nextIndex =
			currentIndex === -1
				? 0
				: Math.min(Math.max(currentIndex + step, 0), containers.length - 1)
		const next = containers[nextIndex]
		if (!next) return

		onSelectContainer(next.id)
		listRef.current
			?.querySelector<HTMLElement>(`[data-container-id="${CSS.escape(next.id)}"]`)
			?.focus()
	}

	if (isLoading) {
		return (
			<div className='dk-list' aria-busy='true' aria-label='Loading containers'>
				{[64, 48, 72, 56].map((width) => (
					<div key={width} className='dk-skel-row'>
						<span
							className='dk-skel'
							style={{ width: 7, height: 7, borderRadius: 999 }}
						/>
						<span className='dk-skel' style={{ width: `${width}%` }} />
					</div>
				))}
			</div>
		)
	}

	if (containers.length === 0 && !pendingContainer) {
		if (searchQuery.trim()) {
			return (
				<EmptyState
					className='flex-1'
					size='sm'
					headingLevel='h3'
					loop
					illustration={<SearchIllustration />}
					title={`No containers match "${searchQuery}"`}
					description='Try a name, an image like postgres:16 or a port.'
					actions={
						onClearSearch
							? [
									{
										id: 'clear-search',
										label: 'Clear search',
										variant: 'secondary',
										onClick: onClearSearch
									}
								]
							: []
					}
				/>
			)
		}

		if (hasActiveFilters) {
			return (
				<EmptyState
					className='flex-1'
					size='sm'
					headingLevel='h3'
					loop
					illustration={<IconStack icon={<Container />} />}
					title='Nothing in this view'
					description='No containers match the current filters.'
					actions={
						onResetFilters
							? [
									{
										id: 'reset-filters',
										label: 'Show all containers',
										variant: 'secondary',
										onClick: onResetFilters
									}
								]
							: []
					}
				/>
			)
		}

		return (
			<EmptyState
				className='flex-1'
				size='sm'
				headingLevel='h3'
				loop
				pointer
				illustration={<IconStack icon={<Container />} />}
				title='No containers yet'
				description='Create your first database container to start working with local development databases.'
			/>
		)
	}

	const groupCounts = containers.reduce<Record<StatusGroup, number>>(
		(counts, item) => {
			counts[getStatusGroup(item)] += 1
			return counts
		},
		{ running: 0, stopped: 0, created: 0 }
	)

	return (
		<div
			ref={listRef}
			role='listbox'
			aria-label='Docker containers'
			className='dk-list'
			onKeyDown={handleKeyDown}
		>
			{pendingContainer && (
				<div className='dk-row' role='option' aria-selected='false' aria-busy='true'>
					<StatusDot tone='busy' label='Creating' />
					<span className='dk-r-main'>
						<span className='dk-r-name dk-mono'>{pendingContainer.name}</span>
						<span className='dk-r-img dk-mono'>
							{formatImage({
								image: pendingContainer.image,
								imageTag: pendingContainer.imageTag
							})}
						</span>
					</span>
					<span className='dk-r-port dk-mono'>:{pendingContainer.hostPort}</span>
					<span className='dk-r-age dk-mono'>new</span>
				</div>
			)}
			{containers.map((container, index) => {
				const group = getStatusGroup(container)
				const showGroup =
					groupByStatus &&
					(index === 0 || getStatusGroup(containers[index - 1]) !== group)
				const action =
					pendingAction?.containerId === container.id ? pendingAction.action : null
				const status = getContainerStatus(container.state, container.health, action)
				const isSelected = container.id === selectedContainerId
				const isDim = container.state !== 'running' && !action
				const port = container.ports.length > 0 ? getPrimaryDatabasePort(container) : null
				const image = formatImage(container)

				return (
					<Fragment key={container.id}>
						{showGroup && (
							<div className='dk-grp' role='presentation'>
								{GROUP_LABELS[group]}
								<span className='dk-grp-n dk-mono'>{groupCounts[group]}</span>
							</div>
						)}
						<button
							type='button'
							role='option'
							className='dk-row'
							data-container-card='true'
							data-container-id={container.id}
							data-dim={isDim}
							aria-selected={isSelected}
							tabIndex={isSelected || (!selectedContainerId && index === 0) ? 0 : -1}
							title={`${container.name} · ${status.label}`}
							onClick={() => onSelectContainer(container.id)}
						>
							<StatusDot tone={status.tone} label={status.label} />
							<span className='dk-r-main'>
								<span className='dk-r-name dk-mono'>
									{highlight(container.name, searchQuery)}
								</span>
								<span className='dk-r-img dk-mono'>
									{highlight(image, searchQuery)}
								</span>
								{container.origin === 'external' && (
									<span className='dk-ext' title='Not created by Dora'>
										ext
									</span>
								)}
							</span>
							<span className='dk-r-port dk-mono'>
								{port === null ? '—' : highlight(`:${port}`, searchQuery)}
							</span>
							<span className='dk-r-age dk-mono' title='Age since created'>
								{formatShortAge(container.createdAt)}
							</span>
						</button>
					</Fragment>
				)
			})}
		</div>
	)
}
