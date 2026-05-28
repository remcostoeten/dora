import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRowSelection } from '@/features/database-studio/components/data-grid/use-row-selection'

describe('useRowSelection', function () {
	it('replaces the selected rows with the shift-click range', function () {
		const lastClickedRowRef = { current: 1 as number | null }
		const onRowSelect = vi.fn()
		const onRowsSelect = vi.fn()
		const onSelectAll = vi.fn()
		const selectedRows = new Set([7])

		const { result } = renderHook(function () {
			return useRowSelection({
				lastClickedRowRef,
				onRowSelect,
				onRowsSelect,
				onSelectAll,
				selectedRows
			})
		})

		act(function () {
			result.current.handleRowClick(
				{
					button: 0,
					shiftKey: true,
					ctrlKey: false,
					metaKey: false,
					preventDefault: vi.fn()
				} as any,
				4
			)
		})

		expect(onSelectAll).toHaveBeenCalledWith(false)
		expect(onRowsSelect).toHaveBeenCalledWith([1, 2, 3, 4], true)
		expect(onRowSelect).not.toHaveBeenCalled()
		expect(lastClickedRowRef.current).toBe(1)
	})
})
