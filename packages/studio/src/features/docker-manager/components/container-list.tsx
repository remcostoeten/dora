import { Container } from 'lucide-react'
import { useRef } from 'react'
import type { DockerContainer } from '../types'
import { ContainerCard } from './container-card'
import {
	ContainerCardSkeleton,
	PendingContainerCard,
	type PendingContainer
} from './container-card-skeleton'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack, SearchIllustration } from '@studio/shared/ui/empty-state-illustrations'

type Props = {
	containers: DockerContainer[]
	selectedContainerId: string | null
	onSelectContainer: (id: string) => void
	onStartContainer?: (id: string) => void
	onStopContainer?: (id: string) => void
	onRestartContainer?: (id: string) => void
	onOpenContainerInDataViewer?: (container: DockerContainer) => void
	onRemoveContainer?: (id: string) => void
	isActionPending?: boolean
	isLoading?: boolean
	searchQuery?: string
	onClearSearch?: () => void
	pendingContainer?: PendingContainer | null
}

export function ContainerList({
	containers,
	selectedContainerId,
	onSelectContainer,
	onStartContainer,
	onStopContainer,
	onRestartContainer,
	onOpenContainerInDataViewer,
	onRemoveContainer,
	isActionPending = false,
	isLoading = false,
	searchQuery = '',
	onClearSearch,
	pendingContainer = null
}: Props) {
	const listRef = useRef<HTMLDivElement>(null)

	function handleArrowNavigation(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
			return
		}

		const cards = listRef.current?.querySelectorAll<HTMLElement>('[data-container-card="true"]')
		if (!cards || cards.length === 0) {
			return
		}

		const activeElement = document.activeElement as HTMLElement | null
		const currentIndex = activeElement
			? Array.from(cards).findIndex(function (card) {
					return card === activeElement
				})
			: -1

		if (currentIndex === -1) {
			cards[0]?.focus()
			event.preventDefault()
			return
		}

		const step = event.key === 'ArrowDown' ? 1 : -1
		const nextIndex = Math.min(Math.max(currentIndex + step, 0), cards.length - 1)
		const nextCard = cards[nextIndex]
		if (!nextCard) {
			return
		}

		nextCard.focus()
		const nextContainerId = nextCard.dataset.containerId
		if (nextContainerId) {
			onSelectContainer(nextContainerId)
		}

		event.preventDefault()
	}

	if (isLoading) {
		return (
			<div
				aria-busy='true'
				aria-label='Loading containers'
				className='flex-1 overflow-y-auto'
			>
				<div className='p-3 space-y-2'>
					<ContainerCardSkeleton />
					<ContainerCardSkeleton />
					<ContainerCardSkeleton />
				</div>
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
					description='Try another search term or clear the search to view all containers.'
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

	return (
		<div
			ref={listRef}
			role='listbox'
			aria-label='Docker containers'
			className='flex-1 overflow-y-auto'
			onKeyDown={handleArrowNavigation}
		>
			<div className='p-3 space-y-2'>
				{pendingContainer && <PendingContainerCard container={pendingContainer} />}
				{containers.map(function (container) {
					return (
						<ContainerCard
							key={container.id}
							container={container}
							isSelected={container.id === selectedContainerId}
							onSelect={onSelectContainer}
							onStart={onStartContainer}
							onStop={onStopContainer}
							onRestart={onRestartContainer}
							onOpenInDataViewer={onOpenContainerInDataViewer}
							onRemove={onRemoveContainer}
							isActionPending={isActionPending}
						/>
					)
				})}
			</div>
		</div>
	)
}
