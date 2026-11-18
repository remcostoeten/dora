import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutStore } from '@studio/core/shortcuts'
import { GridHarness, createGridSpies, createPeople } from './grid-harness'

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

function getActiveCellKey() {
	const id = getGrid().getAttribute('aria-activedescendant')
	return id ? document.getElementById(id)?.getAttribute('data-cell-key') : null
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid row and cell actions', function () {
	it('opens the row menu on its first item, shows shortcuts and returns focus on Escape', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowDown}{ArrowRight}')
		await user.keyboard('{Alt>}{Shift>}{F10}{/Shift}{/Alt}')

		const first = await screen.findByRole('menuitem', { name: /View details/ })
		await waitFor(() => expect(first).toHaveFocus())
		expect(screen.getByRole('menuitem', { name: /Edit row/ })).toHaveTextContent('Alt')
		expect(screen.getByRole('menuitem', { name: /Delete row/ })).toHaveTextContent(/Del/i)

		await user.keyboard('{Escape}')
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
		expect(getGrid()).toHaveFocus()
		expect(getActiveCellKey()).toBe('1:1')
	})

	it('deletes a row through the row menu', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		const rows = createPeople(4)
		render(<GridHarness spies={spies} rows={rows} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowDown}')
		await user.keyboard('{Alt>}{Shift>}{F10}{/Shift}{/Alt}')
		await screen.findByRole('menuitem', { name: /View details/ })
		await user.keyboard('{End}{Enter}')

		expect(spies.onRowAction).toHaveBeenCalledWith('delete', rows[1], 1, undefined)
	})

	it('opens the cell menu on Edit cell and starts editing from it', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Shift>}{F10}{/Shift}')
		const edit = await screen.findByRole('menuitem', { name: /Edit cell/ })
		await waitFor(() => expect(edit).toHaveFocus())

		await user.keyboard('{Enter}')
		expect(await screen.findByRole('textbox', { name: 'Edit name in row 1' })).toHaveFocus()
	})

	it('runs edit, view, duplicate and insert row from the focused cell', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		const rows = createPeople(4)
		render(<GridHarness spies={spies} rows={rows} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowDown}')
		await user.keyboard('{Alt>}{Enter}{/Alt}')
		await user.keyboard('{Shift>}{Enter}{/Shift}')
		await user.keyboard('{Control>}{Shift>}d{/Shift}{/Control}')

		expect(spies.onRowAction.mock.calls).toEqual([
			['edit', rows[1], 1, undefined],
			['view', rows[1], 1, undefined],
			['duplicate', rows[1], 1, undefined]
		])

		await user.keyboard('o')
		await user.keyboard('{Shift>}O{/Shift}')
		await user.keyboard('{Insert}')
		expect(spies.onInsertRow.mock.calls).toEqual([
			[1, 'below'],
			[1, 'above'],
			[1, 'below']
		])
	})

	it('duplicates every checked row when the focused row is one of them', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		const rows = createPeople(4)
		render(<GridHarness spies={spies} rows={rows} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}{ArrowDown}{/Shift} ')
		await user.keyboard('{Control>}{Shift>}d{/Shift}{/Control}')

		expect(spies.onRowAction).toHaveBeenCalledWith('duplicate', rows[1], 1, [0, 1])
	})

	it('sets nullable cells to NULL and refuses the others with a notice', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>}{Backspace}{/Control}')
		expect(spies.onCellsEdit).not.toHaveBeenCalled()
		expect(spies.onNotify).toHaveBeenLastCalledWith({
			level: 'warning',
			message: 'name cannot be NULL'
		})

		await user.keyboard(
			'{Shift>}{ArrowRight}{ArrowDown}{/Shift}{Control>}{Backspace}{/Control}'
		)
		expect(spies.onCellsEdit).toHaveBeenCalledWith([
			{ rowIndex: 0, columnName: 'email', value: null },
			{ rowIndex: 1, columnName: 'email', value: null }
		])
	})

	it('fills down from the top row of the selection', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
		await user.keyboard('{Control>}d{/Control}')

		expect(spies.onCellsEdit).toHaveBeenCalledWith([
			{ rowIndex: 1, columnName: 'name', value: 'Person 1' },
			{ rowIndex: 2, columnName: 'name', value: 'Person 1' }
		])
	})

	it('commits one typed value into every selected cell', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{ArrowRight}{/Shift}{Enter}')
		await user.keyboard('same{Control>}{Shift>}{Enter}{/Shift}{/Control}')

		expect(spies.onBatchCellEdit.mock.calls).toEqual([
			[[0, 1], 'name', 'same'],
			[[0, 1], 'email', 'same']
		])
		expect(spies.onCellEdit).not.toHaveBeenCalled()
		expect(screen.queryByRole('textbox')).toBeNull()
	})

	it('tells the user how much of a clipped paste was dropped', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(2)} />)
		vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('a\tb\tc\nd\te\tf\ng\th\ti')

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}v')

		await waitFor(() => expect(spies.onCellsEdit).toHaveBeenCalledTimes(1))
		expect(spies.onCellsEdit.mock.calls[0][0]).toHaveLength(4)
		expect(spies.onNotify).toHaveBeenCalledWith({
			level: 'warning',
			message: 'Pasted 4 cells. 5 cells did not fit: 1 row and 1 column are outside the grid.'
		})
	})

	it('blocks every new command in privacy mode', async function () {
		privacy.masked = true
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Alt>}{Enter}{/Alt}{Shift>}{Enter}{/Shift}o')
		await user.keyboard('{Control>}{Backspace}d{Shift>}d{/Shift}{/Control}')
		await user.keyboard('{Alt>}{Shift>}{F10}{/Shift}{/Alt}')

		expect(spies.onRowAction).not.toHaveBeenCalled()
		expect(spies.onInsertRow).not.toHaveBeenCalled()
		expect(spies.onCellsEdit).not.toHaveBeenCalled()
		expect(screen.queryByRole('menu')).toBeNull()
	})
})
