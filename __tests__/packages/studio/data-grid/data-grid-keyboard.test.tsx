import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutStore } from '@studio/core/shortcuts'
import { GridHarness, createGridSpies } from './grid-harness'

const privacy = vi.hoisted(function () {
	return { masked: false }
})

vi.mock('@studio/core/settings', function () {
	return {
		useSettings: function () {
			return { settings: { privacyMaskData: privacy.masked } }
		}
	}
})

beforeEach(function () {
	privacy.masked = false
	vi.stubGlobal('requestAnimationFrame', function (callback: FrameRequestCallback) {
		callback(0)
		return 1
	})
	vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(function () {
	vi.unstubAllGlobals()
	act(function () {
		useShortcutStore.getState().resetAll()
	})
})

function getGrid() {
	return screen.getByRole('grid', { name: 'Data grid for people' })
}

function getActiveCell() {
	const id = getGrid().getAttribute('aria-activedescendant')
	return id ? document.getElementById(id) : null
}

function getSelectedCellCount() {
	return getGrid().querySelectorAll('td[data-cell-key][aria-selected="true"]').length
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	expect(getGrid()).toHaveFocus()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid keyboard', function () {
	it('exposes the active cell, selection, dimensions and sort state', function () {
		const spies = createGridSpies()
		render(
			<GridHarness
				spies={spies}
				sort={{ column: 'name', direction: 'asc' }}
				selectedCells={new Set(['0:1'])}
				initialFocusedCell={{ row: 0, col: 1 }}
			/>
		)

		const grid = getGrid()
		expect(grid).toHaveAttribute('aria-rowcount', '5')
		expect(grid).toHaveAttribute('aria-colcount', '4')
		expect(grid).toHaveAttribute('aria-multiselectable', 'true')
		expect(grid).toHaveAttribute('aria-readonly', 'false')
		expect(getActiveCell()).toHaveAttribute('role', 'gridcell')
		expect(getActiveCell()).toHaveAttribute('aria-colindex', '3')
		expect(getActiveCell()).toHaveAttribute('aria-selected', 'true')
		expect(screen.getByRole('columnheader', { name: /name text/i })).toHaveAttribute(
			'aria-sort',
			'ascending'
		)
	})

	it('navigates, extends a selection, edits and sorts without a pointer', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		expect(getActiveCell()).toHaveAttribute('data-cell-key', '0:0')

		await user.keyboard('{ArrowRight}{ArrowDown}')
		expect(getActiveCell()).toHaveAttribute('data-cell-key', '1:1')

		await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}')
		expect(getActiveCell()).toHaveAttribute('data-cell-key', '2:2')
		expect(getSelectedCellCount()).toBe(4)

		await user.keyboard('{Escape}')
		expect(getSelectedCellCount()).toBe(1)

		await user.keyboard('{Control>}{ArrowUp}{/Control}')
		expect(getActiveCell()).toHaveAttribute('data-cell-key', '0:2')

		await user.keyboard('s')
		expect(spies.onSortChange).toHaveBeenLastCalledWith({ column: 'email', direction: 'asc' })

		await user.keyboard('{Enter}')
		const editor = screen.getByRole('textbox', { name: 'Edit email in row 1' })
		expect(editor).toHaveFocus()
		await user.keyboard('ada@example.com{Enter}')
		expect(spies.onCellEdit).toHaveBeenCalledWith(0, 'email', 'ada@example.com')
		expect(spies.onCellEdit).toHaveBeenCalledTimes(1)
	})

	it('clears selected cells with Backspace and keeps primary keys', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}{Backspace}')

		expect(spies.onCellsEdit).toHaveBeenCalledTimes(1)
		expect(spies.onCellsEdit).toHaveBeenCalledWith([
			{ rowIndex: 0, columnName: 'name', value: '' },
			{ rowIndex: 0, columnName: 'email', value: null }
		])
	})

	it('toggles the focused row with Space', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard(' ')
		expect(screen.getByRole('checkbox', { name: 'Select row 1' })).toBeChecked()

		await user.keyboard(' ')
		expect(screen.getByRole('checkbox', { name: 'Select row 1' })).not.toBeChecked()
	})

	it('runs select all and delete exactly once per key press', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Control>}a{/Control}')
		expect(spies.onSelectAll).toHaveBeenCalledTimes(1)
		expect(spies.onSelectAll).toHaveBeenCalledWith(true)

		await user.keyboard('d')
		await user.keyboard('{Delete}')
		expect(spies.onDeleteSelectedRows).toHaveBeenCalledTimes(2)
	})

	it('does not run a bare-letter command for the second key of a go-to chord', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('gd')
		expect(spies.onDeleteSelectedRows).not.toHaveBeenCalled()

		await user.keyboard('d')
		expect(spies.onDeleteSelectedRows).toHaveBeenCalledTimes(1)
	})

	it('applies a remapped shortcut inside the grid', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		act(function () {
			useShortcutStore.getState().setShortcut('gridSortColumn', 'x')
		})
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('s')
		expect(spies.onSortChange).not.toHaveBeenCalled()

		await user.keyboard('x')
		expect(spies.onSortChange).toHaveBeenCalledWith({ column: 'id', direction: 'asc' })
	})

	it('blocks edit, clear and delete in privacy mode but still navigates', async function () {
		privacy.masked = true
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Enter}{Backspace}d{Delete}')

		expect(getActiveCell()).toHaveAttribute('data-cell-key', '0:1')
		expect(screen.queryByRole('textbox')).toBeNull()
		expect(spies.onCellEdit).not.toHaveBeenCalled()
		expect(spies.onCellsEdit).not.toHaveBeenCalled()
		expect(spies.onDeleteSelectedRows).not.toHaveBeenCalled()
	})

	it('leaves typed keys alone while the cell editor is open', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}e')
		await user.keyboard('dsc{Escape}')

		expect(spies.onDeleteSelectedRows).not.toHaveBeenCalled()
		expect(spies.onSortChange).not.toHaveBeenCalled()
		expect(spies.onCellEdit).not.toHaveBeenCalled()
	})
})
