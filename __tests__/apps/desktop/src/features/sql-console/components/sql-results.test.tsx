import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SqlResults } from '../../../../../../../apps/desktop/src/features/sql-console/components/sql-results'
import * as dataProviderModule from '@/core/data-provider'
import * as settingsModule from '@/core/settings'

describe('SqlResults', function () {
	const updateCellMutate = vi.fn()
	const deleteRowsMutate = vi.fn()

	beforeEach(function () {
		vi.clearAllMocks()

		vi.spyOn(dataProviderModule, 'useDataMutation').mockReturnValue({
			updateCell: {
				mutate: updateCellMutate
			},
			deleteRows: {
				mutate: deleteRowsMutate
			}
		} as any)

		vi.spyOn(settingsModule, 'useSettings').mockReturnValue({
			settings: {
				confirmBeforeDelete: true
			}
		} as any)
	})

	it('updates the filtered row instead of the unfiltered row at the same index', async function () {
		const result = {
			columns: ['id', 'name'],
			rows: [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' }
			],
			rowCount: 2,
			executionTime: 5,
			queryType: 'SELECT',
			sourceTable: 'users',
			columnDefinitions: [
				{ name: 'id', primaryKey: true },
				{ name: 'name', primaryKey: false }
			]
		} as any

		render(
			<SqlResults
				result={result}
				viewMode='table'
				onViewModeChange={function () {}}
				onExport={function () {}}
				connectionId='conn-1'
				showFilter
			/>
		)

		fireEvent.change(screen.getByPlaceholderText('Filter results...'), {
			target: { value: 'Bob' }
		})

		fireEvent.doubleClick(screen.getByText('Bob'))

		const input = screen.getByDisplayValue('Bob')
		fireEvent.change(input, { target: { value: 'Bobby' } })
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(updateCellMutate).toHaveBeenCalledTimes(1)
		expect(updateCellMutate).toHaveBeenCalledWith(
			expect.objectContaining({
				connectionId: 'conn-1',
				tableName: 'users',
				primaryKeyColumn: 'id',
				primaryKeyValue: 2,
				columnName: 'name',
				newValue: 'Bobby'
			}),
			expect.any(Object)
		)
	})
})
