import React from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataGrid } from '../data-grid'
import { getCellsToClear, parseClipboardGrid, useGridKeyboard } from './use-grid-keyboard'

vi.mock('@studio/core/settings', function () {
	return {
		useSettings: function () {
			return { settings: { privacyMaskData: false } }
		}
	}
})

vi.mock('@studio/core/shortcuts', async function (importOriginal) {
	const actual = await importOriginal<typeof import('@studio/core/shortcuts')>()
	const chain = {
		in: function () {
			return chain
		},
		except: function () {
			return chain
		},
		on: function () {
			return chain
		}
	}
	return {
		...actual,
		useEffectiveShortcuts: function () {
			return {
				selectAll: { combo: 'mod+a', description: 'Select all' },
				deselect: { combo: 'mod+d', description: 'Deselect' }
			}
		},
		useShortcut: function () {
			return {
				bind: function () {
					return chain
				}
			}
		}
	}
})

beforeEach(function () {
	vi.stubGlobal('requestAnimationFrame', function (callback: FrameRequestCallback) {
		callback(0)
		return 1
	})
	vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(function () {
	vi.unstubAllGlobals()
})

function createKeyboardEvent(key: string, shiftKey = false): React.KeyboardEvent {
	return {
		key,
		shiftKey,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		preventDefault: vi.fn()
	} as unknown as React.KeyboardEvent
}

function createColumns() {
	return [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'name', type: 'text', nullable: false, primaryKey: false },
		{ name: 'email', type: 'text', nullable: true, primaryKey: false }
	]
}

describe('parseClipboardGrid', () => {
	it('splits LF-delimited TSV into rows and cells', () => {
		expect(parseClipboardGrid('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('strips CRLF line endings so no \\r lands in cell values', () => {
		expect(parseClipboardGrid('a\tb\r\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('handles bare CR line endings', () => {
		expect(parseClipboardGrid('a\tb\rc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('drops the single trailing newline instead of producing a phantom row', () => {
		expect(parseClipboardGrid('a\tb\n')).toEqual([['a', 'b']])
		expect(parseClipboardGrid('a\tb\r\n')).toEqual([['a', 'b']])
	})

	it('keeps interior blank lines positional', () => {
		expect(parseClipboardGrid('a\n\nb')).toEqual([['a'], [''], ['b']])
	})

	it('keeps a deliberate empty trailing cell', () => {
		expect(parseClipboardGrid('a\t')).toEqual([['a', '']])
	})
})

describe('useGridKeyboard', function () {
	it('extends a rectangular cell selection with vertical Shift+Arrow navigation', function () {
		const updateCellSelection = vi.fn()
		const onRowsSelect = vi.fn()
		const setFocusedCell = vi.fn()
		const columns = createColumns()
		const rows = [
			{ id: 1, name: 'Ada', email: 'ada@example.com' },
			{ id: 2, name: 'Grace', email: 'grace@example.com' },
			{ id: 3, name: 'Linus', email: 'linus@example.com' }
		]
		const { result } = renderHook(function () {
			return useGridKeyboard({
				anchorCell: { row: 0, col: 1 },
				allSelected: false,
				columns,
				editingCell: null,
				focusedCell: { row: 0, col: 1 },
				lastClickedRowRef: { current: 0 },
				onRowsSelect,
				onRowSelect: vi.fn(),
				onSelectAll: vi.fn(),
				rows,
				selectedCellsSet: new Set(['0:1']),
				selectedRows: new Set(),
				setAnchorCell: vi.fn(),
				setFocusedCell,
				startCellEdit: vi.fn(),
				updateCellSelection
			})
		})

		act(function () {
			result.current(createKeyboardEvent('ArrowDown', true))
		})

		expect(setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 1 })
		expect(updateCellSelection).toHaveBeenCalledWith(new Set(['0:1', '1:1']))
		expect(onRowsSelect).not.toHaveBeenCalled()
	})

	it('clears every selected editable cell while preserving primary keys', function () {
		const onCellEdit = vi.fn()
		const columns = createColumns()
		const rows = [
			{ id: 1, name: 'Ada', email: 'ada@example.com' },
			{ id: 2, name: 'Grace', email: 'grace@example.com' }
		]
		const { result } = renderHook(function () {
			return useGridKeyboard({
				anchorCell: { row: 0, col: 0 },
				allSelected: false,
				columns,
				editingCell: null,
				focusedCell: { row: 0, col: 0 },
				lastClickedRowRef: { current: 0 },
				onCellEdit,
				onRowSelect: vi.fn(),
				onSelectAll: vi.fn(),
				rows,
				selectedCellsSet: new Set(['0:0', '0:1', '1:2']),
				selectedRows: new Set(),
				setAnchorCell: vi.fn(),
				setFocusedCell: vi.fn(),
				startCellEdit: vi.fn(),
				updateCellSelection: vi.fn()
			})
		})

		act(function () {
			result.current(createKeyboardEvent('Backspace'))
		})

		expect(onCellEdit).toHaveBeenCalledTimes(2)
		expect(onCellEdit).toHaveBeenCalledWith(0, 'name', '')
		expect(onCellEdit).toHaveBeenCalledWith(1, 'email', null)
	})

	it('sorts the focused column with S', function () {
		const onSortColumn = vi.fn()
		const columns = createColumns()
		const { result } = renderHook(function () {
			return useGridKeyboard({
				anchorCell: { row: 0, col: 1 },
				allSelected: false,
				columns,
				editingCell: null,
				focusedCell: { row: 0, col: 1 },
				lastClickedRowRef: { current: 0 },
				onSortColumn,
				onRowSelect: vi.fn(),
				onSelectAll: vi.fn(),
				rows: [{ id: 1, name: 'Ada', email: 'ada@example.com' }],
				selectedCellsSet: new Set(['0:1']),
				selectedRows: new Set(),
				setAnchorCell: vi.fn(),
				setFocusedCell: vi.fn(),
				startCellEdit: vi.fn(),
				updateCellSelection: vi.fn()
			})
		})

		act(function () {
			result.current(createKeyboardEvent('s'))
		})

		expect(onSortColumn).toHaveBeenCalledWith('name')
	})

	it('opens the focused cell menu with Shift+F10', function () {
		const onOpenCellMenu = vi.fn()
		const columns = createColumns()
		const { result } = renderHook(function () {
			return useGridKeyboard({
				anchorCell: { row: 0, col: 2 },
				allSelected: false,
				columns,
				editingCell: null,
				focusedCell: { row: 0, col: 2 },
				lastClickedRowRef: { current: 0 },
				onOpenCellMenu,
				onRowSelect: vi.fn(),
				onSelectAll: vi.fn(),
				rows: [{ id: 1, name: 'Ada', email: 'ada@example.com' }],
				selectedCellsSet: new Set(['0:2']),
				selectedRows: new Set(),
				setAnchorCell: vi.fn(),
				setFocusedCell: vi.fn(),
				startCellEdit: vi.fn(),
				updateCellSelection: vi.fn()
			})
		})

		act(function () {
			result.current(createKeyboardEvent('F10', true))
		})

		expect(onOpenCellMenu).toHaveBeenCalledWith(0, 2)
	})
})

describe('DataGrid accessibility', function () {
	it('exposes the active cell, selection, dimensions, and sort state', function () {
		render(
			React.createElement(DataGrid, {
				columns: createColumns(),
				rows: [
					{ id: 1, name: 'Ada', email: 'ada@example.com' },
					{ id: 2, name: 'Grace', email: 'grace@example.com' }
				],
				selectedRows: new Set<number>(),
				onRowSelect: vi.fn(),
				onSelectAll: vi.fn(),
				onCellEdit: vi.fn(),
				onSortChange: vi.fn(),
				sort: { column: 'name', direction: 'asc' },
				selectedCells: new Set(['0:1']),
				initialFocusedCell: { row: 0, col: 1 },
				tableName: 'people',
				workspaceStateKey: 'accessibility-test-grid'
			})
		)

		const grid = screen.getByRole('grid', { name: 'Data grid for people' })
		const activeCellId = grid.getAttribute('aria-activedescendant')
		const activeCell = activeCellId ? document.getElementById(activeCellId) : null

		expect(grid).toHaveAttribute('aria-rowcount', '3')
		expect(grid).toHaveAttribute('aria-colcount', '4')
		expect(grid).toHaveAttribute('aria-multiselectable', 'true')
		expect(grid).toHaveAttribute('aria-readonly', 'false')
		expect(activeCell).toHaveAttribute('role', 'gridcell')
		expect(activeCell).toHaveAttribute('aria-colindex', '3')
		expect(activeCell).toHaveAttribute('aria-selected', 'true')
		expect(screen.getByRole('columnheader', { name: /name text/i })).toHaveAttribute(
			'aria-sort',
			'ascending'
		)
	})
})

describe('getCellsToClear', function () {
	it('falls back to the focused cell when there is no selection', function () {
		expect(getCellsToClear(new Set(), { row: 2, col: 3 })).toEqual([{ row: 2, col: 3 }])
	})
})
