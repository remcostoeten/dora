import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { QueryTabProvider, useQueryTabs } from '@studio/features/sql-console/stores/tab-store'

function storageKey(connectionId: string): string {
	return `dora-query-tabs-${connectionId}`
}

function seed(connectionId: string, sql: string): void {
	localStorage.setItem(
		storageKey(connectionId),
		JSON.stringify({
			tabs: [{ id: `tab-${connectionId}`, title: 'Query 1', mode: 'sql', sqlContent: sql, drizzleContent: '', result: null, isExecuting: false, isDirty: false, viewMode: 'table', chartConfig: null, historyEntryId: null, connectionId, createdAt: 0, lastExecutedAt: null }],
			activeTabId: `tab-${connectionId}`
		})
	)
}

function ActiveQuery() {
	const { activeTab } = useQueryTabs()
	return <span data-testid="query">{activeTab?.sqlContent ?? ''}</span>
}

function readStoredQuery(connectionId: string): string | undefined {
	const raw = localStorage.getItem(storageKey(connectionId))
	if (!raw) return undefined
	return JSON.parse(raw).tabs[0]?.sqlContent
}

describe('QueryTabProvider connection switching', function () {
	beforeEach(() => {
		localStorage.clear()
	})

	it('does not overwrite the incoming connection\'s saved tabs', function () {
		seed('a', 'SELECT 1 FROM a')
		seed('b', 'SELECT 2 FROM b')

		const { rerender } = render(
			<QueryTabProvider connectionId="a">
				<ActiveQuery />
			</QueryTabProvider>
		)

		rerender(
			<QueryTabProvider connectionId="b">
				<ActiveQuery />
			</QueryTabProvider>
		)

		expect(readStoredQuery('b')).toBe('SELECT 2 FROM b')
		expect(readStoredQuery('a')).toBe('SELECT 1 FROM a')
	})

	it('loads the incoming connection\'s tabs into state', function () {
		seed('a', 'SELECT 1 FROM a')
		seed('b', 'SELECT 2 FROM b')

		const { rerender, getByTestId } = render(
			<QueryTabProvider connectionId="a">
				<ActiveQuery />
			</QueryTabProvider>
		)
		expect(getByTestId('query').textContent).toBe('SELECT 1 FROM a')

		rerender(
			<QueryTabProvider connectionId="b">
				<ActiveQuery />
			</QueryTabProvider>
		)
		expect(getByTestId('query').textContent).toBe('SELECT 2 FROM b')
	})

	it('round-trips A to B and back without losing either side', function () {
		seed('a', 'SELECT 1 FROM a')
		seed('b', 'SELECT 2 FROM b')

		const tree = function (connectionId: string) {
			return (
				<QueryTabProvider connectionId={connectionId}>
					<ActiveQuery />
				</QueryTabProvider>
			)
		}

		const { rerender } = render(tree('a'))
		rerender(tree('b'))
		rerender(tree('a'))

		expect(readStoredQuery('a')).toBe('SELECT 1 FROM a')
		expect(readStoredQuery('b')).toBe('SELECT 2 FROM b')
	})
})
