import { Container } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/shared/ui/button'
import type { DockerContainer } from '../types'
import { ContainerCard } from './container-card'

type Props = {
	containers: DockerContainer[]
	selectedContainerId: string | null
	onSelectContainer: (id: string) => void
	onStartContainer?: (id: string) => void
	onStopContainer?: (id: string) => void
	onRestartContainer?: (id: string) => void
	isActionPending?: boolean
	isLoading?: boolean
	searchQuery?: string
	onClearSearch?: () => void
}

export function ContainerList({
	containers,
	selectedContainerId,
	onSelectContainer,
	onStartContainer,
	onStopContainer,
	onRestartContainer,
	isActionPending = false,
	isLoading = false,
	searchQuery = '',
	onClearSearch
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
			<div className='flex-1 flex items-center justify-center'>
				<div className='text-center'>
					<div className='h-8 w-8 mx-auto mb-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin' />
					<p className='text-sm text-muted-foreground'>Loading containers...</p>
				</div>
			</div>
		)
	}

	if (containers.length === 0) {
		if (searchQuery.trim()) {
			return (
				<div className='flex-1 flex items-center justify-center p-8'>
					<div className='max-w-[280px] text-center space-y-2'>
						<Container className='h-10 w-10 mx-auto text-muted-foreground/50' />
						<h3 className='text-sm font-medium'>No containers match "{searchQuery}"</h3>
						<p className='text-xs text-muted-foreground'>
							Try another search term or clear the search to view all containers.
						</p>
						{onClearSearch && (
							<Button
								type='button'
								variant='outline'
								size='sm'
								className='mt-2'
								onClick={onClearSearch}
							>
								Clear Search
							</Button>
						)}
					</div>
				</div>
			)
		}

		return (
			<div className='flex-1 flex items-center justify-center p-8'>
				<div className='text-center'>
					<Container className='h-12 w-12 mx-auto mb-4 text-muted-foreground/50' />
					<h3 className='text-sm font-medium mb-1'>No containers yet</h3>
					<p className='text-xs text-muted-foreground max-w-[200px]'>
						Create your first PostgreSQL container to start working with local
						development databases.
					</p>
				</div>
			</div>
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
							isActionPending={isActionPending}
						/>
					)
				})}
			</div>
		</div>
	)
}
