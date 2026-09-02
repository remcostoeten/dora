import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { TooltipProvider } from '@studio/shared/ui/tooltip'
import { DataFileSourcePanel } from './data-file-source-panel'

const ACTIVE_ENTRIES: DataFileSourceEntry[] = [
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

const MISSING_ENTRY: DataFileSourceEntry = {
	path: '/exports/moved.csv',
	viewName: 'moved',
	fileType: 'CSV',
	status: 'missing',
	error: 'File not found'
}

function renderPanel(entries: DataFileSourceEntry[], onRetry = vi.fn()) {
	return render(
		<TooltipProvider>
			<DataFileSourcePanel
				entries={entries}
				health='active'
				onRetry={onRetry}
				onRemove={vi.fn()}
				onRelocate={vi.fn()}
			/>
		</TooltipProvider>
	)
}

describe('DataFileSourcePanel', () => {
	it('starts collapsed when every file is active and expands on click', () => {
		renderPanel(ACTIVE_ENTRIES)

		expect(screen.getByText('2 files')).toBeInTheDocument()
		expect(screen.queryByText('followers_older')).not.toBeInTheDocument()

		fireEvent.click(screen.getByText('Data files'))

		expect(screen.getByText('followers_older')).toBeInTheDocument()
		expect(screen.getByText('/exports/followers-newer.csv')).toBeInTheDocument()
	})

	it('starts expanded with recovery actions when a file has issues', () => {
		renderPanel([...ACTIVE_ENTRIES, MISSING_ENTRY])

		expect(screen.getByText('moved')).toBeInTheDocument()
		expect(screen.getByText('File not found')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /retry registration/i })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /locate file/i })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /remove source/i })).toBeInTheDocument()
	})
})
