import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useGridKeyboard } from '@/features/database-studio/components/data-grid/use-grid-keyboard'
import type { CellPosition, EditingCell } from '@/features/database-studio/components/data-grid/types'
import type { ColumnDefinition } from '@/features/database-studio/types'

function createColumns(): ColumnDefinition[] {
	return [
		{ name: 'id', type: 'int', nullable: false, primaryKey: true },
		{ name: 'name', type: 'text', nullable: false, primaryKey: false }
	]
}

describe('useGridKeyboard', function () {
	beforeEach(function () {
		vi.stubGlobal('requestAnimationFrame', function (cb: FrameRequestCallback) {
			cb(0)
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
	})

	afterEach(function () {
		vi.unstubAllGlobals()
	})

	it('extends the selected row range with shift plus arrow up', function () {
		const focusedCell: CellPosition = { row: 2, col: 1 }
		const anchorCell: CellPosition = { row: 2, col: 1 }
		const lastClickedRowRef = { current: null as number | null }
		const setFocusedCell = vi.fn()
		const setAnchorCell = vi.fn()
		const updateCellSelection = vi.fn()
		const onSelectAll = vi.fn()
		const onRowsSelect = vi.fn()
		const selectedRows = new Set<number>()

		const { result } = renderHook(function () {
			return useGridKeyboard({
				anchorCell,
				allSelected: false,
				columns: createColumns(),
				editingCell: null as EditingCell | null,
				focusedCell,
				lastClickedRowRef,
				onRowsSelect,
				onRowSelect: vi.fn(),
				onSelectAll,
				rows: [
					{ id: 1, name: 'Alpha' },
					{ id: 2, name: 'Beta' },
					{ id: 3, name: 'Gamma' }
				],
				selectedCellsSet: new Set(['2:1']),
				selectedRows,
				setAnchorCell,
				setEditingCell: vi.fn(),
				setEditValue: vi.fn(),
				setFocusedCell,
				startCellEdit: vi.fn(),
				updateCellSelection
			})
		})

		act(function () {
			result.current({
				key: 'ArrowUp',
				shiftKey: true,
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				preventDefault: vi.fn(),
				stopPropagation: vi.fn()
			} as any)
		})

		expect(setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 1 })
		expect(onSelectAll).toHaveBeenCalledWith(false)
		expect(onRowsSelect).toHaveBeenCalledWith([1, 2], true)
		expect(updateCellSelection).toHaveBeenCalledWith(new Set())
		expect(lastClickedRowRef.current).toBe(2)
	})
})
