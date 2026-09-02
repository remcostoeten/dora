import { render, screen } from '@testing-library/react'
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
})
