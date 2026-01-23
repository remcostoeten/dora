import { Container } from "lucide-react";
import type { DockerContainer } from "../types";
import { ContainerCard } from "./container-card";

type Props = {
	containers: DockerContainer[]
	selectedContainerId: string | null
	onSelectContainer: (id: string) => void
	isLoading?: boolean
}

export function ContainerList({
	containers,
	selectedContainerId,
	onSelectContainer,
	isLoading = false
}: Props) {
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
		<div className='flex-1 overflow-y-auto'>
			<div className='p-3 space-y-2'>
				{containers.map(function (container) {
					return (
						<ContainerCard
							key={container.id}
							container={container}
							isSelected={container.id === selectedContainerId}
							onSelect={onSelectContainer}
						/>
					)
				})}
			</div>
		</div>
	)
}
