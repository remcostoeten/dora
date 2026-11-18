import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutStore } from '@studio/core/shortcuts'
import { GridHarness, createGridSpies } from './grid-harness'

vi.mock('@studio/core/settings', function () {
	return {
		useSettings: function () {
			return { settings: { privacyMaskData: false } }
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
	act(function () {
		useShortcutStore.getState().resetAll()
	})
})

function getGrid() {
	return screen.getByRole('grid', { name: 'Data grid for people' })
}

function getActiveElement() {
	const id = getGrid().getAttribute('aria-activedescendant')
	return id ? document.getElementById(id) : null
}

function getColumnWidth(colIndex: number) {
	const col = getGrid().querySelectorAll('colgroup col')[colIndex + 1]
	return col instanceof HTMLElement ? col.style.width : ''
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid header row', function () {
	it('enters the header with ArrowUp from the first row and walks its cells', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{ArrowUp}')
		expect(getActiveElement()).toHaveAttribute('role', 'columnheader')
		expect(getActiveElement()).toHaveTextContent('name')
		expect(getGrid()).toHaveFocus()

		await user.keyboard('{ArrowRight}')
		expect(getActiveElement()).toHaveTextContent('email')

		await user.keyboard('{ArrowRight}{ArrowUp}{Home}')
		expect(getActiveElement()).toHaveTextContent('id')

		await user.keyboard('{End}{ArrowDown}')
		expect(getActiveElement()).toHaveAttribute('data-cell-key', '0:2')
	})

	it('sorts from a header cell by cycling and by setting a direction', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{ArrowUp}{Enter}')
		expect(spies.onSortChange).toHaveBeenLastCalledWith({ column: 'name', direction: 'asc' })
		expect(getActiveElement()).toHaveAttribute('aria-sort', 'ascending')

		await user.keyboard('s')
		expect(spies.onSortChange).toHaveBeenLastCalledWith({ column: 'name', direction: 'desc' })

		await user.keyboard('{Enter}')
		expect(spies.onSortChange).toHaveBeenLastCalledWith(undefined)

		await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
		expect(spies.onSortChange).toHaveBeenLastCalledWith({ column: 'name', direction: 'desc' })

		await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
		expect(spies.onSortChange).toHaveBeenLastCalledWith({ column: 'name', direction: 'asc' })
		expect(screen.queryByRole('textbox')).toBeNull()
	})

	it('resizes the column in 10px steps down to the minimum and fits it again', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} workspaceStateKey='header-resize' />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{ArrowUp}')
		expect(getColumnWidth(1)).toBe('150px')

		await user.keyboard('{Alt>}{ArrowRight}{ArrowRight}{/Alt}')
		expect(getColumnWidth(1)).toBe('170px')

		await user.keyboard('{Alt>}{ArrowLeft>9/}{/Alt}')
		expect(getColumnWidth(1)).toBe('100px')

		await user.keyboard('{Alt>}0{/Alt}')
		expect(getColumnWidth(1)).not.toBe('170px')
		expect(getColumnWidth(0)).toBe('150px')
	})

	it('hides and filters the focused column from the header only', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}hf')
		expect(spies.onHideColumn).not.toHaveBeenCalled()
		expect(spies.onFilterColumn).not.toHaveBeenCalled()

		await user.keyboard('{Control>}{Shift>}f{/Shift}{/Control}')
		expect(spies.onFilterColumn).toHaveBeenLastCalledWith('name')

		await user.keyboard('{ArrowUp}{ArrowRight}f')
		expect(spies.onFilterColumn).toHaveBeenLastCalledWith('email')

		await user.keyboard('h')
		expect(spies.onHideColumn).toHaveBeenCalledWith('email')
	})

	it('keeps row and cell mutations out of the header and leaves it on Escape', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{ArrowUp}')
		await user.keyboard('d{Delete}{Backspace}e{F2}o{Control>}{Backspace}d{/Control}')

		expect(spies.onDeleteSelectedRows).not.toHaveBeenCalled()
		expect(spies.onCellsEdit).not.toHaveBeenCalled()
		expect(spies.onInsertRow).not.toHaveBeenCalled()
		expect(screen.queryByRole('textbox')).toBeNull()
		expect(getActiveElement()).toHaveAttribute('role', 'columnheader')

		await user.keyboard('{Escape}')
		expect(getActiveElement()).toHaveAttribute('data-cell-key', '0:1')
	})
})
