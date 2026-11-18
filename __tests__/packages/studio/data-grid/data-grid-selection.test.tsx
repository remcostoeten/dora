import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutStore } from '@studio/core/shortcuts'
import { GridHarness, createGridSpies, createPeople } from './grid-harness'

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

function getSelectedCellKeys() {
	const grid = screen.getByRole('grid', { name: 'Data grid for people' })
	return Array.from(grid.querySelectorAll('td[data-cell-key][aria-selected="true"]'), (cell) =>
		cell.getAttribute('data-cell-key')
	)
}

function isRowChecked(rowNumber: number) {
	return (
		screen
			.getByRole('checkbox', { name: `Select row ${rowNumber}` })
			.getAttribute('aria-checked') === 'true'
	)
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid selection', function () {
	it('selects the whole row with Shift+Space and every row of a selection', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowDown}{ArrowRight}{Shift>} {/Shift}')
		expect(getSelectedCellKeys()).toEqual(['1:0', '1:1', '1:2'])

		await user.keyboard('{Shift>}{ArrowDown} {/Shift}')
		expect(getSelectedCellKeys()).toEqual(['1:0', '1:1', '1:2', '2:0', '2:1', '2:2'])
	})

	it('selects the whole column with Ctrl+Space', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>} {/Control}')
		expect(getSelectedCellKeys()).toEqual(['0:1', '1:1', '2:1', '3:1'])

		await user.keyboard('{Shift>}{ArrowRight}{/Shift}{Control>} {/Control}')
		expect(getSelectedCellKeys()).toHaveLength(8)
	})

	it('checks every row of a multi-row selection with Space and unchecks them again', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift} ')
		expect([1, 2, 3, 4].map(isRowChecked)).toEqual([true, true, true, false])

		await user.keyboard(' ')
		expect([1, 2, 3, 4].map(isRowChecked)).toEqual([false, false, false, false])
	})

	it('extends the selection by pages and to the row and grid edges', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(30)} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}{PageDown}{/Shift}')
		expect(getSelectedCellKeys()).toHaveLength(11)

		await user.keyboard('{Shift>}{End}{/Shift}')
		expect(getSelectedCellKeys()).toHaveLength(33)

		await user.keyboard('{Shift>}{PageUp}{Home}{/Shift}')
		expect(getSelectedCellKeys()).toEqual(['0:0'])

		await user.keyboard('{Control>}{Shift>}{End}{/Shift}{/Control}')
		expect(getSelectedCellKeys()).toHaveLength(90)

		await user.keyboard('{Control>}{Shift>}{Home}{/Shift}{/Control}')
		expect(getSelectedCellKeys()).toEqual(['0:0'])

		await user.keyboard('{Control>}{Shift>}{ArrowDown}{ArrowRight}{/Shift}{/Control}')
		expect(getSelectedCellKeys()).toHaveLength(90)
	})
})
