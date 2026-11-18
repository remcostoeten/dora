import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutStore } from '@studio/core/shortcuts'
import { GridHarness, createGridSpies } from './grid-harness'
import { StagingHarness, createStagingMocks } from './staging-harness'

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

function getCell(key: string) {
	const cell = getGrid().querySelector(`[data-cell-key="${key}"]`)
	if (!cell) throw new Error(`No cell ${key}`)
	return cell
}

function getStagedCount() {
	return screen.getByRole('status', { name: 'Staged edits' }).textContent
}

async function focusFirstCell(user: ReturnType<typeof userEvent.setup>) {
	await user.tab()
	await user.keyboard('{ArrowDown}')
}

describe('DataGrid dry run commands', function () {
	it('reports dry run, undo, redo and revert intent to the owner', async function () {
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowDown}{ArrowRight}')
		await user.keyboard('{Control>}{Shift>}e{/Shift}s{Shift>}{Backspace}p{/Shift}{/Control}')
		await user.keyboard('{Control>}z{Shift>}z{/Shift}y{/Control}')
		await user.keyboard('{Alt>}{Backspace}{Shift>}{Backspace}{/Shift}{/Alt}')

		expect(spies.onStagedAction.mock.calls.map((call) => call[0])).toEqual([
			'toggle-dry-mode',
			'apply',
			'discard',
			'preview',
			'undo',
			'redo',
			'redo'
		])
		expect(spies.onRevertStaged.mock.calls).toEqual([
			[1, 'name'],
			[1, null]
		])
	})

	it('blocks the dry run commands in privacy mode', async function () {
		privacy.masked = true
		const user = userEvent.setup()
		const spies = createGridSpies()
		render(<GridHarness spies={spies} />)

		await focusFirstCell(user)
		await user.keyboard('{Control>}{Shift>}e{/Shift}sz{/Control}{Alt>}{Backspace}{/Alt}')

		expect(spies.onStagedAction).not.toHaveBeenCalled()
		expect(spies.onRevertStaged).not.toHaveBeenCalled()
	})
})

describe('staging edits from the keyboard', function () {
	it('stages, reverts, undoes, redoes, previews, confirms a discard and applies', async function () {
		const user = userEvent.setup()
		const mocks = createStagingMocks()
		render(<StagingHarness connectionId='staging-flow' mocks={mocks} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>}{Shift>}e{/Shift}{/Control}')
		expect(screen.getByRole('status', { name: 'Dry run mode' })).toHaveTextContent('on')

		await user.keyboard('{Enter}Zed{Enter}')
		await user.keyboard('{ArrowDown}{Enter}Yan{Enter}')
		expect(getStagedCount()).toBe('2')
		expect(getCell('0:1')).toHaveTextContent('Zed')
		expect(getCell('1:1')).toHaveTextContent('Yan')
		expect(mocks.updateCell.mutate).not.toHaveBeenCalled()

		await user.keyboard('{Alt>}{Backspace}{/Alt}')
		expect(getStagedCount()).toBe('1')
		expect(getCell('1:1')).toHaveTextContent('Person 2')

		await user.keyboard('{Control>}z{/Control}')
		expect(getStagedCount()).toBe('2')
		expect(getCell('1:1')).toHaveTextContent('Yan')

		await user.keyboard('{Control>}z{/Control}')
		expect(getStagedCount()).toBe('1')
		expect(getCell('1:1')).toHaveTextContent('Person 2')

		await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
		expect(getStagedCount()).toBe('2')
		expect(getCell('1:1')).toHaveTextContent('Yan')

		await user.keyboard('{Control>}{Shift>}p{/Shift}{/Control}')
		const preview = await screen.findByRole('dialog', { name: 'Staged edits as SQL' })
		expect(preview).toHaveTextContent(`UPDATE "people" SET "name" = 'Zed' WHERE "id" = 1;`)
		expect(preview).toHaveTextContent(`UPDATE "people" SET "name" = 'Yan' WHERE "id" = 2;`)
		await user.keyboard('{Escape}')
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

		await waitFor(() => expect(getGrid()).toHaveFocus())
		await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}')
		const confirm = await screen.findByRole('alertdialog')
		expect(confirm).toHaveTextContent('Discard 2 staged edits?')
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus()
		)
		await user.keyboard('{Escape}')
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(getStagedCount()).toBe('2')

		await waitFor(() => expect(getGrid()).toHaveFocus())
		await user.keyboard('{Control>}s{/Control}')
		await waitFor(() => expect(getStagedCount()).toBe('0'))
		expect(mocks.updateCell.mutateAsync).toHaveBeenCalledTimes(2)
		expect(mocks.updateCell.mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({ primaryKeyValue: 2, columnName: 'name', newValue: 'Yan' })
		)
		expect(getCell('1:1')).toHaveTextContent('Yan')
	})

	it('discards every staged edit after confirming with the keyboard', async function () {
		const user = userEvent.setup()
		const mocks = createStagingMocks()
		render(<StagingHarness connectionId='staging-discard' mocks={mocks} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>}{Shift>}e{/Shift}{/Control}{Enter}Zed{Enter}')
		expect(getStagedCount()).toBe('1')

		await user.keyboard('{Control>}{Shift>}{Backspace}{/Shift}{/Control}')
		await screen.findByRole('alertdialog')
		await user.tab()
		expect(screen.getByRole('button', { name: 'Discard' })).toHaveFocus()
		await user.keyboard('{Enter}')

		await waitFor(() => expect(getStagedCount()).toBe('0'))
		expect(mocks.loadTableData).toHaveBeenCalledTimes(1)
		expect(mocks.updateCell.mutateAsync).not.toHaveBeenCalled()
	})

	it('stages a multi-cell clear as one step that one undo takes back', async function () {
		const user = userEvent.setup()
		const mocks = createStagingMocks()
		render(<StagingHarness connectionId='staging-batch' mocks={mocks} />)

		await focusFirstCell(user)
		await user.keyboard('{ArrowRight}{Control>}{Shift>}e{/Shift}{/Control}')
		await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}{Backspace}')
		expect(getStagedCount()).toBe('4')
		expect(mocks.updateCells.mutateAsync).not.toHaveBeenCalled()

		await user.keyboard('{Control>}z{/Control}')
		expect(getStagedCount()).toBe('0')
		expect(getCell('0:1')).toHaveTextContent('Person 1')
	})
})
