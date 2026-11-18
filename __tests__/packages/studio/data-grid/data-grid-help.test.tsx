import { act, render, screen, waitFor } from '@testing-library/react'
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

const ROWS = [
	{ id: 1, name: 'Ada', email: 'ada@example.com' },
	{ id: 2, name: '', email: null },
	{ id: 3, name: 'Linus', email: 'linus@example.com' }
]

function getGrid() {
	return screen.getByRole('grid', { name: 'Data grid for people' })
}

function getLiveText() {
	return screen.getByRole('status').textContent
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid cheat sheet', function () {
	it('opens with a question mark, filters by typing and returns focus on Escape', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}?{/Shift}')

		const dialog = await screen.findByRole('dialog', { name: 'Grid keyboard shortcuts' })
		expect(dialog).toHaveTextContent('Go to cell')
		expect(dialog).toHaveTextContent('Fill down')
		expect(dialog).toHaveTextContent('Header row')
		expect(screen.getByRole('textbox', { name: 'Filter shortcuts' })).toHaveFocus()

		await user.keyboard('redo')
		expect(dialog).toHaveTextContent('Redo')
		expect(dialog).not.toHaveTextContent('Go to cell')

		await user.keyboard('{Escape}')
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(getGrid()).toHaveFocus()
	})

	it('shows a remapped shortcut', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		act(function () {
			useShortcutStore.getState().setShortcut('gridGoToCell', 'alt+j')
		})
		render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}?{/Shift}go to cell')

		const dialog = await screen.findByRole('dialog', { name: 'Grid keyboard shortcuts' })
		expect(dialog).toHaveTextContent(/Alt.*J/i)
	})

	it('types a question mark into the cell editor instead of opening help', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Enter}why{Shift>}?{/Shift}{Enter}')

		expect(screen.queryByRole('dialog')).toBeNull()
		expect(spies.onCellEdit).toHaveBeenCalledWith(0, 'name', 'why?')
	})
})

describe('DataGrid live announcements', function () {
	it('announces the focused cell and tells NULL from empty', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={ROWS} rowNumberOffset={50} />)

		await focusFirstCell(user)
		expect(getLiveText()).toBe('id, row 51, 1')

		await user.keyboard('{ArrowRight}')
		expect(getLiveText()).toBe('name, row 51, Ada')

		await user.keyboard('{ArrowDown}')
		expect(getLiveText()).toBe('name, row 52, empty')

		await user.keyboard('{ArrowRight}')
		expect(getLiveText()).toBe('email, row 52, NULL')
	})

	it('never announces a value in privacy mode', async function () {
		privacy.masked = true
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{ArrowRight}')

		expect(getLiveText()).toBe('email, row 1, hidden')
		expect(screen.getByRole('status')).not.toHaveTextContent('ada@example.com')
	})

	it('announces selection size, checked rows and the header', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}')
		expect(getLiveText()).toBe('4 cells selected')

		await user.keyboard(' ')
		expect(getLiveText()).toBe('2 rows selected')

		await user.keyboard('{Escape}{Escape}')
		expect(getLiveText()).toBe('Row selection cleared')

		await user.keyboard('{Control>}{ArrowUp}{/Control}{ArrowUp}')
		expect(getLiveText()).toBe('name, column header')

		await user.keyboard('{Enter}')
		expect(getLiveText()).toBe('name, column header, sorted ascending')
	})

	it('announces refused commands and outcomes sent by the owner', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		const { rerender } = render(<GridHarness spies={spies} rows={ROWS} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>}{Backspace}{/Control}')
		expect(getLiveText()).toBe('name cannot be NULL')

		rerender(
			<GridHarness
				spies={spies}
				rows={ROWS}
				liveMessage={{ id: 1, text: '2 rows deleted' }}
			/>
		)
		expect(getLiveText()).toBe('2 rows deleted')
	})
})
