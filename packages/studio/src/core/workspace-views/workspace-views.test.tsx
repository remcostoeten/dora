import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceView, WorkspaceViews } from './workspace-views'

type Props = {
	label: string
	onMount: () => void
}

function TrackedView({ label, onMount }: Props) {
	useEffect(onMount, [onMount])
	return <div>{label}</div>
}

describe('WorkspaceViews', () => {
	it('mounts on first open and keeps the view connected while inactive', () => {
		const databaseMount = vi.fn()
		const consoleMount = vi.fn()
		const { rerender } = render(
			<WorkspaceViews activeViewId='database-studio'>
				<WorkspaceView id='database-studio'>
					<TrackedView label='Database' onMount={databaseMount} />
				</WorkspaceView>
				<WorkspaceView id='sql-console'>
					<TrackedView label='Console' onMount={consoleMount} />
				</WorkspaceView>
			</WorkspaceViews>
		)

		const databaseNode = screen.getByText('Database')
		expect(databaseMount).toHaveBeenCalledTimes(1)
		expect(consoleMount).not.toHaveBeenCalled()

		rerender(
			<WorkspaceViews activeViewId='sql-console'>
				<WorkspaceView id='database-studio'>
					<TrackedView label='Database' onMount={databaseMount} />
				</WorkspaceView>
				<WorkspaceView id='sql-console'>
					<TrackedView label='Console' onMount={consoleMount} />
				</WorkspaceView>
			</WorkspaceViews>
		)

		expect(databaseNode.isConnected).toBe(true)
		expect(databaseNode.closest('section')).toHaveAttribute('hidden')
		expect(databaseNode.closest('section')?.inert).toBe(true)
		expect(databaseMount).toHaveBeenCalledTimes(1)
		expect(consoleMount).toHaveBeenCalledTimes(1)
	})
})
