import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
	useViewActivity,
	useWhileViewActive,
	WorkspaceView,
	WorkspaceViews,
	type ViewActivity
} from './workspace-views'

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

	it('runs view effects while shown without re-rendering the view on a switch', () => {
		const renders = vi.fn()
		const started = vi.fn()
		const stopped = vi.fn()
		const seen: { activity: ViewActivity | null } = { activity: null }

		function ActivityProbe() {
			renders()
			seen.activity = useViewActivity()
			useWhileViewActive(() => {
				started()
				return stopped
			})
			return <div>Probe</div>
		}

		const probe = <ActivityProbe />
		function renderViews(activeViewId: string) {
			return (
				<WorkspaceViews activeViewId={activeViewId}>
					<WorkspaceView id='database-studio'>{probe}</WorkspaceView>
					<WorkspaceView id='sql-console'>
						<div>Console</div>
					</WorkspaceView>
				</WorkspaceViews>
			)
		}

		const { rerender } = render(renderViews('database-studio'))
		expect(renders).toHaveBeenCalledTimes(1)
		expect(started).toHaveBeenCalledTimes(1)
		expect(seen.activity?.isActive()).toBe(true)

		rerender(renderViews('sql-console'))
		expect(stopped).toHaveBeenCalledTimes(1)
		expect(seen.activity?.isActive()).toBe(false)

		rerender(renderViews('database-studio'))
		expect(started).toHaveBeenCalledTimes(2)
		expect(seen.activity?.isActive()).toBe(true)
		expect(renders).toHaveBeenCalledTimes(1)
	})

	it('reports active outside a workspace view', () => {
		const seen: { activity: ViewActivity | null } = { activity: null }
		function Probe() {
			seen.activity = useViewActivity()
			return null
		}
		render(<Probe />)
		expect(seen.activity?.isActive()).toBe(true)
	})
})
