import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { FollowerDiffButton } from './follower-diff-button'

const mocks = vi.hoisted(() => {
	const executeQuery = vi.fn()
	const cancelQueries = vi.fn()
	return {
		executeQuery,
		cancelQueries,
		adapter: { executeQuery, cancelQueries }
	}
})

vi.mock('@studio/core/data-provider', () => ({
	useAdapter: () => mocks.adapter
}))

vi.mock('@studio/core/settings/settings-store', () => ({
	useSettings: () => ({ settings: { privacyMaskData: false } })
}))

const ENTRIES: DataFileSourceEntry[] = [
	{
		path: '/exports/followers-older.csv',
		viewName: 'followers_older',
		fileType: 'CSV',
		status: 'active',
		error: null
	},
	{
		path: '/exports/followers-newer.csv',
		viewName: 'followers_newer',
		fileType: 'CSV',
		status: 'active',
		error: null
	}
]

describe('FollowerDiffButton', () => {
	beforeEach(() => {
		mocks.executeQuery.mockReset()
		mocks.cancelQueries.mockReset()
	})

	it('shows accounts found in the older export but not the newer export', async () => {
		mocks.executeQuery
			.mockResolvedValueOnce({
				ok: true,
				data: {
					columns: ['column_name'],
					rows: [
						{ column_name: 'User Id' },
						{ column_name: 'Username' },
						{ column_name: 'Fullname' }
					],
					rowCount: 3
				}
			})
			.mockResolvedValueOnce({
				ok: true,
				data: {
					columns: ['column_name'],
					rows: [
						{ column_name: 'User Id' },
						{ column_name: 'Username' },
						{ column_name: 'Fullname' }
					],
					rowCount: 3
				}
			})
			.mockResolvedValueOnce({
				ok: true,
				data: {
					columns: ['User Id', 'Username', 'Fullname'],
					rows: [
						{ 'User Id': '1000000001', Username: 'gone_user', Fullname: 'Gone User' }
					],
					rowCount: 1
				}
			})

		render(<FollowerDiffButton connectionId='followers' entries={ENTRIES} />)
		fireEvent.click(screen.getByRole('button', { name: 'Compare followers' }))

		const compareButton = await screen.findByRole('button', { name: 'Find unfollowers' })
		await waitFor(() => expect(compareButton).toBeEnabled())
		fireEvent.click(compareButton)

		expect(await screen.findByText('gone_user')).toBeInTheDocument()
		expect(screen.getByText('Unfollowed (1)')).toBeInTheDocument()
		expect(mocks.executeQuery).toHaveBeenLastCalledWith(
			'followers',
			expect.stringContaining('NOT EXISTS'),
			expect.any(Object)
		)
	})
})
