import { describe, expect, it } from 'vitest'
import type { JsonValue } from '@studio/lib/bindings'
import { BufferedQueryRowSource, QUERY_PAGE_SIZE } from './query-row-source'

function buildPage(start: number): JsonValue {
	return Array.from({ length: QUERY_PAGE_SIZE }, (_, index) => [start + index])
}

describe('BufferedQueryRowSource', () => {
	it('reads a range across buffered and on-demand pages', async () => {
		const fetched: number[] = []
		const source = new BufferedQueryRowSource(
			[{ name: 'id', type: 'integer', nullable: false, primaryKey: true }],
			2,
			async (pageIndex) => {
				fetched.push(pageIndex)
				return buildPage(pageIndex * QUERY_PAGE_SIZE)
			}
		)
		source.push(0, buildPage(0))

		const rows = await source.rows({ start: 495, end: 505 })

		expect(rows.map((row) => row.id)).toEqual([
			495, 496, 497, 498, 499, 500, 501, 502, 503, 504
		])
		expect(fetched).toEqual([1])
	})

	it('iterates every page for explicit exports', async () => {
		const source = new BufferedQueryRowSource(
			[{ name: 'id', type: 'integer', nullable: false, primaryKey: true }],
			3,
			async (pageIndex) => buildPage(pageIndex * QUERY_PAGE_SIZE)
		)
		let rowCount = 0

		for await (const page of source.pages()) rowCount += page.length

		expect(rowCount).toBe(QUERY_PAGE_SIZE * 3)
	})

	it('evicts old pages when the cache limit is reached', async () => {
		const fetched: number[] = []
		const source = new BufferedQueryRowSource(
			[{ name: 'id', type: 'integer', nullable: false, primaryKey: true }],
			3,
			async (pageIndex) => {
				fetched.push(pageIndex)
				return buildPage(pageIndex * QUERY_PAGE_SIZE)
			},
			2
		)

		await source.rows({ start: 0, end: 1 })
		await source.rows({ start: QUERY_PAGE_SIZE, end: QUERY_PAGE_SIZE + 1 })
		await source.rows({ start: QUERY_PAGE_SIZE * 2, end: QUERY_PAGE_SIZE * 2 + 1 })
		await source.rows({ start: 0, end: 1 })

		expect(fetched).toEqual([0, 1, 2, 0])
	})
})
