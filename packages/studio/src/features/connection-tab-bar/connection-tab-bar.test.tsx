import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '@studio/features/connections/types'
import { ConnectionTabBar } from './connection-tab-bar'

function makeConnection(overrides: Partial<Connection>): Connection {
	return {
		id: 'id',
		name: 'Connection',
		type: 'postgres',
		status: 'connected',
		createdAt: 0,
		...overrides
	}
}

function renderBar(connections: Connection[]) {
	return render(
		<ConnectionTabBar
			connections={connections}
			activeConnectionId={connections[0]?.id ?? ''}
			onSelect={vi.fn()}
			onClose={vi.fn()}
			onAddConnection={vi.fn()}
		/>
	)
}

describe('ConnectionTabBar', () => {
	it('shows no hint when names are unique', () => {
		renderBar([
			makeConnection({ id: 'a', name: 'Neon DB', database: 'app' }),
			makeConnection({ id: 'b', name: 'Local', database: 'app' })
		])

		expect(screen.getByRole('button', { name: 'Neon DB, Connected' })).toBeInTheDocument()
		expect(screen.queryByText('app')).not.toBeInTheDocument()
	})

	it('disambiguates duplicate names with a differing detail', () => {
		renderBar([
			makeConnection({ id: 'a', name: 'Neon DB', database: 'staging' }),
			makeConnection({ id: 'b', name: 'Neon DB', database: 'production' })
		])

		expect(screen.getByText('staging')).toBeInTheDocument()
		expect(screen.getByText('production')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Neon DB (staging), Connected' })
		).toBeInTheDocument()
	})

	it('falls back to positional numbering when details also match', () => {
		renderBar([
			makeConnection({ id: 'a', name: 'Neon DB', database: 'app' }),
			makeConnection({ id: 'b', name: 'Neon DB', database: 'app' })
		])

		expect(screen.getByText('#1')).toBeInTheDocument()
		expect(screen.getByText('#2')).toBeInTheDocument()
	})

	it('uses the file name for data-file sessions', () => {
		renderBar([
			makeConnection({
				id: 'a',
				name: 'followers',
				type: 'duckdb',
				fileSources: ['/exports/followers_410.csv']
			}),
			makeConnection({
				id: 'b',
				name: 'followers',
				type: 'duckdb',
				fileSources: ['/exports/followers_415.csv']
			})
		])

		expect(screen.getByText('followers_410.csv')).toBeInTheDocument()
		expect(screen.getByText('followers_415.csv')).toBeInTheDocument()
	})

	it('mounts one context menu for the whole bar instead of one per tab', () => {
		renderBar([
			makeConnection({ id: 'a', name: 'One' }),
			makeConnection({ id: 'b', name: 'Two' }),
			makeConnection({ id: 'c', name: 'Three' })
		])

		expect(document.querySelectorAll('[data-slot="context-menu-trigger"]')).toHaveLength(1)
	})

	it('targets the tab that was right-clicked', async () => {
		const onClose = vi.fn()
		const connections = [
			makeConnection({ id: 'a', name: 'One' }),
			makeConnection({ id: 'b', name: 'Two' })
		]
		render(
			<ConnectionTabBar
				connections={connections}
				activeConnectionId='a'
				onSelect={vi.fn()}
				onClose={onClose}
				onCloseConnectionsToLeft={vi.fn()}
				onCloseConnectionsToRight={vi.fn()}
				onAddConnection={vi.fn()}
			/>
		)

		fireEvent.contextMenu(screen.getByRole('button', { name: 'Two, Connected' }))

		expect(
			await screen.findByRole('menuitem', { name: /close connections to left/i })
		).not.toHaveAttribute('data-disabled')
		expect(
			screen.getByRole('menuitem', { name: /close connections to right/i })
		).toHaveAttribute('data-disabled')
		fireEvent.click(screen.getByRole('menuitem', { name: /close connection$/i }))
		expect(onClose).toHaveBeenCalledWith('b')
	})

	it('re-renders only the tabs whose active state changed', () => {
		const reads: Record<string, number> = { a: 0, b: 0, c: 0 }
		function probed(id: string, name: string): Connection {
			return Object.defineProperty(makeConnection({ id, name }), 'status', {
				enumerable: true,
				get() {
					reads[id] += 1
					return 'connected'
				}
			})
		}
		const connections = [probed('a', 'One'), probed('b', 'Two'), probed('c', 'Three')]
		const handlers = { onSelect: vi.fn(), onClose: vi.fn(), onAddConnection: vi.fn() }
		function Slot() {
			return null
		}

		const view = render(
			<ConnectionTabBar
				connections={connections}
				activeConnectionId='a'
				rightSlot={<Slot />}
				{...handlers}
			/>
		)
		const afterMount = { ...reads }

		view.rerender(
			<ConnectionTabBar
				connections={[...connections]}
				activeConnectionId='a'
				rightSlot={<Slot />}
				{...handlers}
			/>
		)
		expect(reads).toEqual(afterMount)

		view.rerender(
			<ConnectionTabBar
				connections={[...connections]}
				activeConnectionId='b'
				rightSlot={<Slot />}
				{...handlers}
			/>
		)
		expect(reads.c).toBe(afterMount.c)
		expect(reads.a).toBeGreaterThan(afterMount.a)
		expect(reads.b).toBeGreaterThan(afterMount.b)
	})
})
