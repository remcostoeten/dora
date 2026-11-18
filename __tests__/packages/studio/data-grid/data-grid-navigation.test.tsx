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

describe('DataGrid navigation', function () {
	it('moves by a screen of rows and jumps to row and grid edges', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(30)} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{PageDown}')
		expect(getActiveCellKey()).toBe('10:1')

		await user.keyboard('{PageDown}{PageDown}')
		expect(getActiveCellKey()).toBe('29:1')

		await user.keyboard('{PageUp}')
		expect(getActiveCellKey()).toBe('19:1')

		await user.keyboard('{End}')
		expect(getActiveCellKey()).toBe('19:2')

		await user.keyboard('{Home}')
		expect(getActiveCellKey()).toBe('19:0')

		await user.keyboard('{Control>}{End}{/Control}')
		expect(getActiveCellKey()).toBe('29:2')

		await user.keyboard('{Control>}{Home}{/Control}')
		expect(getActiveCellKey()).toBe('0:0')
	})

	it('goes to a row and column typed into the prompt and returns focus to the grid', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(30)} />)

		await focusFirstCell(user)
		await user.keyboard('{Control>}g{/Control}')
		const prompt = screen.getByRole('textbox', { name: 'Go to cell' })
		expect(prompt).toHaveFocus()

		await user.keyboard('20:email')
		expect(screen.getByRole('status')).toHaveTextContent('Row 20, column email')
		await user.keyboard('{Enter}')

		expect(screen.queryByRole('textbox', { name: 'Go to cell' })).toBeNull()
		expect(getGrid()).toHaveFocus()
		expect(getActiveCellKey()).toBe('19:2')

		await user.keyboard('{Control>}g{/Control}name{Enter}')
		expect(getActiveCellKey()).toBe('19:1')

		await user.keyboard('{Control>}g{/Control}5{Enter}')
		expect(getActiveCellKey()).toBe('4:1')
	})

	it('explains bad input and closes on Escape without moving', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(30)} />)

		await focusFirstCell(user)
		await user.keyboard('{Control>}g{/Control}99:zzz')
		expect(screen.getByRole('status')).toHaveTextContent('Row 99 is past the last row (30)')

		await user.keyboard('{Enter}')
		expect(screen.getByRole('textbox', { name: 'Go to cell' })).toBeInTheDocument()

		await user.keyboard('{Escape}')
		expect(screen.queryByRole('textbox', { name: 'Go to cell' })).toBeNull()
		expect(getGrid()).toHaveFocus()
		expect(getActiveCellKey()).toBe('0:0')
	})

	it('asks the owner for a row on another page', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(
			<GridHarness
				spies={spies}
				rows={createPeople(50)}
				rowNumberOffset={0}
				totalRowCount={500}
			/>
		)

		await focusFirstCell(user)
		await user.keyboard('{Control>}g{/Control}120:email')
		expect(screen.getByRole('status')).toHaveTextContent('loads another page')
		await user.keyboard('{Enter}')

		expect(spies.onRequestRow).toHaveBeenCalledWith(119, 2)
		expect(getActiveCellKey()).toBe('0:0')
	})

	it('reaches a row outside the virtual window without a mounted node', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={createPeople(150)} />)

		await focusFirstCell(user)
		expect(document.querySelector('[data-cell-key="139:1"]')).toBeNull()

		await user.keyboard('{Control>}g{/Control}140:name{Enter}')
		expect(spies.onFocusedCellChange).toHaveBeenLastCalledWith({ row: 139, col: 1 })
		expect(getGrid()).toHaveFocus()
	})

	it('pages the results through the owner', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Alt>}{PageDown}{/Alt}')
		await user.keyboard('{Alt>}{PageUp}{/Alt}')

		expect(spies.onPageChange.mock.calls).toEqual([['next'], ['prev']])
		expect(getActiveCellKey()).toBe('0:0')
	})
})
