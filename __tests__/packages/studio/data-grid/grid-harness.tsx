import { useState, type ComponentProps } from 'react'
import { vi } from 'vitest'
import { DataGrid } from '@studio/features/database-studio/components/data-grid'
import type { ColumnDefinition, SortDescriptor } from '@studio/features/database-studio/types'

type GridProps = ComponentProps<typeof DataGrid>

export const PEOPLE_COLUMNS: ColumnDefinition[] = [
	{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
	{ name: 'name', type: 'text', nullable: false, primaryKey: false },
	{ name: 'email', type: 'text', nullable: true, primaryKey: false }
]

export function createPeople(count: number): Record<string, unknown>[] {
	return Array.from({ length: count }, function (_, index) {
		return { id: index + 1, name: `Person ${index + 1}`, email: `p${index + 1}@example.com` }
	})
}

export function createGridSpies() {
	return {
		onCellEdit: vi.fn(),
		onDeleteSelectedRows: vi.fn(),
		onSelectAll: vi.fn(),
		onSortChange: vi.fn()
	}
}

type HarnessProps = Partial<GridProps> & {
	spies: ReturnType<typeof createGridSpies>
}

export function GridHarness({ spies, rows, columns, ...overrides }: HarnessProps) {
	const gridRows = rows ?? createPeople(4)
	const [selectedRows, setSelectedRows] = useState(new Set<number>())
	const [selectedCells, setSelectedCells] = useState(new Set<string>())
	const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
	const [sort, setSort] = useState<SortDescriptor | undefined>(undefined)

	return (
		<DataGrid
			columns={columns ?? PEOPLE_COLUMNS}
			rows={gridRows}
			tableName='people'
			workspaceStateKey='grid-harness'
			selectedRows={selectedRows}
			onRowSelect={(rowIndex, checked) => {
				setSelectedRows((current) => {
					const next = new Set(current)
					if (checked) next.add(rowIndex)
					else next.delete(rowIndex)
					return next
				})
			}}
			onRowsSelect={(rowIndexes, checked) => {
				setSelectedRows((current) => {
					const next = new Set(current)
					for (const rowIndex of rowIndexes) {
						if (checked) next.add(rowIndex)
						else next.delete(rowIndex)
					}
					return next
				})
			}}
			onSelectAll={(checked) => {
				spies.onSelectAll(checked)
				setSelectedRows(checked ? new Set(gridRows.map((_, index) => index)) : new Set())
			}}
			selectedCells={selectedCells}
			onCellSelectionChange={setSelectedCells}
			initialFocusedCell={focusedCell}
			onFocusedCellChange={setFocusedCell}
			sort={sort}
			onSortChange={(next) => {
				spies.onSortChange(next)
				setSort(next)
			}}
			onCellEdit={spies.onCellEdit}
			onDeleteSelectedRows={spies.onDeleteSelectedRows}
			{...overrides}
		/>
	)
}
