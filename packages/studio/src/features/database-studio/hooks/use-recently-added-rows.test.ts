import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentlyAddedRows } from './use-recently-added-rows'
import type { TableData } from '../types'

function tableWith(rows: Record<string, unknown>[]): TableData {
	return {
		columns: [
			{ name: 'id', type: 'int', nullable: false, primaryKey: true },
			{ name: 'name', type: 'text', nullable: false, primaryKey: false }
		],
		rows,
		totalCount: rows.length,
		executionTime: 1
	}
}

const EXISTING = [
	{ id: 1, name: 'Alpha' },
	{ id: 2, name: 'Beta' }
]

describe('useRecentlyAddedRows', function () {
	beforeEach(function () {
		vi.useFakeTimers()
	})

	afterEach(function () {
		vi.useRealTimers()
	})

	it('highlights nothing until an insert is marked', function () {
		const { result } = renderHook(function () {
			return useRecentlyAddedRows(tableWith(EXISTING), 'id')
		})

		expect(result.current.highlightedRowIndexes.size).toBe(0)
	})

	it('highlights the optimistic copy and keeps it through the reload', function () {
		const optimistic = tableWith([...EXISTING, { name: 'Alpha' }])
		const { result, rerender } = renderHook(
			function (props: { tableData: TableData }) {
				return useRecentlyAddedRows(props.tableData, 'id')
			},
			{ initialProps: { tableData: tableWith(EXISTING) } }
		)

		act(function () {
			result.current.markRowsAdded()
		})

		// The keyless optimistic row reads as new straight away.
		rerender({ tableData: optimistic })
		expect(Array.from(result.current.highlightedRowIndexes)).toEqual([2])

		// ...and so does the authoritative row that replaces it on reload.
		rerender({ tableData: tableWith([...EXISTING, { id: 3, name: 'Alpha' }]) })
		expect(Array.from(result.current.highlightedRowIndexes)).toEqual([2])
	})

	it('fades the highlight out once the grid settles', function () {
		const { result, rerender } = renderHook(
			function (props: { tableData: TableData }) {
				return useRecentlyAddedRows(props.tableData, 'id')
			},
			{ initialProps: { tableData: tableWith(EXISTING) } }
		)

		act(function () {
			result.current.markRowsAdded()
		})
		rerender({ tableData: tableWith([...EXISTING, { id: 3, name: 'Alpha' }]) })
		expect(result.current.highlightedRowIndexes.size).toBe(1)

		act(function () {
			vi.advanceTimersByTime(5000)
		})
		expect(result.current.highlightedRowIndexes.size).toBe(0)
	})

	it('stays quiet on a table with no primary key', function () {
		const { result, rerender } = renderHook(
			function (props: { tableData: TableData }) {
				return useRecentlyAddedRows(props.tableData, undefined)
			},
			{ initialProps: { tableData: tableWith(EXISTING) } }
		)

		act(function () {
			result.current.markRowsAdded()
		})
		rerender({ tableData: tableWith([...EXISTING, { name: 'Alpha' }]) })

		expect(result.current.highlightedRowIndexes.size).toBe(0)
	})
})
