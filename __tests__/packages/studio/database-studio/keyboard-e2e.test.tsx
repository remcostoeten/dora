import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAdapter, resetMockStore } from '@studio/core/data-provider/adapters/mock'
import { createAnalyticsConfig } from '@studio/features/analytics/config'
import { DatabaseStudio } from '@studio/features/database-studio/database-studio'
import { AppProviders } from '@studio/providers'

const CONNECTION_ID = 'demo-ecommerce-001'
const TABLE = 'customers'
const ROW_COUNT = 150
const WAIT = { timeout: 4000 }

const POINTER_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart']

async function seedCustomers(total: number) {
	const adapter = createMockAdapter()
	const existing = await adapter.fetchTableData(CONNECTION_ID, TABLE, 0, 1)
	const have = existing.ok ? existing.data.totalCount : 0
	vi.useFakeTimers({ toFake: ['setTimeout'] })
	try {
		for (let id = have + 1; id <= total; id++) {
			const insert = adapter.insertRow(CONNECTION_ID, TABLE, {
				name: `Customer ${id}`,
				email: `customer${id}@example.com`,
				phone: '+1-555-000-0000',
				city: 'Utrecht',
				country: 'NL',
				created_at: '2026-01-01T00:00:00.000Z'
			})
			await vi.advanceTimersByTimeAsync(1000)
			await insert
		}
	} finally {
		vi.useRealTimers()
	}
}

async function readCustomer(id: number) {
	const adapter = createMockAdapter()
	const page = await adapter.fetchTableData(CONNECTION_ID, TABLE, 0, ROW_COUNT + 10)
	if (!page.ok) throw new Error('Could not read the customers table')
	return {
		row: page.data.rows.find((row) => row.id === id),
		totalCount: page.data.totalCount
	}
}

function renderStudio() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
	})
	return render(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<AppProviders forceMock analyticsConfig={createAnalyticsConfig({ enabled: false })}>
					<div style={{ height: 600 }}>
						<DatabaseStudio
							tableId={TABLE}
							tableName={TABLE}
							activeConnectionId={CONNECTION_ID}
						/>
					</div>
				</AppProviders>
			</QueryClientProvider>
		</MemoryRouter>
	)
}

function getGrid() {
	return screen.getByRole('grid', { name: `Data grid for ${TABLE}` })
}

function getAnnouncement() {
	return screen.getByRole('status').textContent
}

async function expectAnnouncement(text: string | RegExp) {
	await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(text), WAIT)
}

async function tabToGrid(user: ReturnType<typeof userEvent.setup>) {
	for (let presses = 0; presses < 60; presses++) {
		if (document.activeElement === getGrid()) return
		await user.tab()
	}
	throw new Error('Tab never reached the data grid')
}

const pointerEvents: string[] = []

function recordPointerEvent(event: Event) {
	pointerEvents.push(event.type)
}

beforeEach(function () {
	localStorage.clear()
	resetMockStore()
	pointerEvents.length = 0
	for (const type of POINTER_EVENTS) document.addEventListener(type, recordPointerEvent, true)
	vi.stubGlobal('requestAnimationFrame', function (callback: FrameRequestCallback) {
		callback(0)
		return 1
	})
	vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(function () {
	for (const type of POINTER_EVENTS) document.removeEventListener(type, recordPointerEvent, true)
	vi.unstubAllGlobals()
	localStorage.clear()
	resetMockStore()
})

describe('keyboard-only data grid, end to end', function () {
	it(
		'goes to a cell, stages, reverts, applies, undoes, redoes and deletes a row without a pointer',
		{ timeout: 60000 },
		async function () {
			await seedCustomers(ROW_COUNT)
			const original = await readCustomer(120)
			expect(original.totalCount).toBe(ROW_COUNT)

			const user = userEvent.setup()
			renderStudio()
			await screen.findByRole('grid', { name: `Data grid for ${TABLE}` }, WAIT)
			await waitFor(() => expect(getGrid()).toHaveAttribute('aria-rowcount', '51'), WAIT)

			await tabToGrid(user)
			await user.keyboard('{ArrowDown}')
			await expectAnnouncement('id, row 1, 1')

			await user.keyboard('{Control>}g{/Control}120:email')
			await expectAnnouncement('Row 120, column email (loads another page)')
			await user.keyboard('{Enter}')
			await expectAnnouncement('email, row 120, customer120@example.com')
			await waitFor(() => expect(getGrid()).toHaveFocus(), WAIT)

			await user.keyboard('{Control>}{Shift>}e{/Shift}{/Control}')
			await expectAnnouncement('Dry run mode on')

			await user.keyboard('{Enter}staged@example.com{Enter}')
			await expectAnnouncement('1 edit staged')
			await user.keyboard('{ArrowDown}{Enter}second@example.com{Enter}')
			await expectAnnouncement('2 edits staged')
			expect((await readCustomer(120)).row?.email).toBe('customer120@example.com')

			await user.keyboard('{Alt>}{Backspace}{/Alt}')
			await expectAnnouncement('1 edit staged')
			await user.keyboard('{ArrowUp}')
			await expectAnnouncement('email, row 120, staged@example.com')
			await user.keyboard('{ArrowDown}')
			await expectAnnouncement('email, row 121, customer121@example.com')

			await user.keyboard('{Control>}s{/Control}')
			await expectAnnouncement('1 edit applied')
			expect((await readCustomer(120)).row?.email).toBe('staged@example.com')
			expect((await readCustomer(121)).row?.email).toBe('customer121@example.com')

			await user.keyboard('{Control>}{Shift>}e{/Shift}{/Control}')
			await expectAnnouncement('Dry run mode off')

			await user.keyboard('{Control>}z{/Control}')
			await expectAnnouncement('Undid the last change')
			expect((await readCustomer(120)).row?.email).toBe('customer120@example.com')

			await waitFor(() => expect(getGrid()).toHaveAttribute('aria-rowcount', '51'), WAIT)
			await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
			await expectAnnouncement('Redid the last change')
			expect((await readCustomer(120)).row?.email).toBe('staged@example.com')

			await waitFor(() => expect(getGrid()).toHaveAttribute('aria-rowcount', '51'), WAIT)
			await waitFor(() => expect(getGrid()).toHaveFocus(), WAIT)
			await user.keyboard('{Alt>}{Shift>}{F10}{/Shift}{/Alt}')
			const firstItem = await screen.findByRole('menuitem', { name: /View details/ }, WAIT)
			await waitFor(() => expect(firstItem).toHaveFocus(), WAIT)
			await user.keyboard('{End}{Enter}')

			const confirm = await screen.findByRole('alertdialog', {}, WAIT)
			expect(confirm).toHaveTextContent('permanently delete')
			await user.tab()
			expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
			await user.keyboard('{Enter}')

			await expectAnnouncement('1 row deleted')
			const afterDelete = await readCustomer(121)
			expect(afterDelete.row).toBeUndefined()
			expect(afterDelete.totalCount).toBe(ROW_COUNT - 1)

			expect(getAnnouncement()).not.toBe('')
			expect(pointerEvents).toEqual([])
		}
	)
})
