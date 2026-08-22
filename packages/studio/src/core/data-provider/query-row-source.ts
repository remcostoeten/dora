import type { ColumnDefinition } from '@studio/features/database-studio/types'
import type { JsonValue } from '@studio/lib/bindings'

export const QUERY_PAGE_SIZE = 500

export type QueryRowRange = {
	start: number
	end: number
}

export type QueryRowSource = {
	rows(range: QueryRowRange): Promise<Record<string, unknown>[]>
	pages(): AsyncIterable<Record<string, unknown>[]>
}

type FetchPage = (pageIndex: number) => Promise<JsonValue | null>

export class BufferedQueryRowSource implements QueryRowSource {
	readonly #columns: ColumnDefinition[]
	readonly #fetchPage: FetchPage
	readonly #pageCount: number
	readonly #cacheLimit: number
	readonly #pages = new Map<number, Record<string, unknown>[]>()

	constructor(
		columns: ColumnDefinition[],
		pageCount: number,
		fetchPage: FetchPage,
		cacheLimit = 8
	) {
		this.#columns = columns
		this.#pageCount = pageCount
		this.#fetchPage = fetchPage
		this.#cacheLimit = cacheLimit
	}

	push(pageIndex: number, data: JsonValue): void {
		this.#remember(pageIndex, parseQueryRows(data, this.#columns))
	}

	async rows(range: QueryRowRange): Promise<Record<string, unknown>[]> {
		if (range.end <= range.start) return []

		const firstPage = Math.floor(range.start / QUERY_PAGE_SIZE)
		const lastPage = Math.floor((range.end - 1) / QUERY_PAGE_SIZE)
		const rows: Record<string, unknown>[] = []

		for (let pageIndex = firstPage; pageIndex <= lastPage; pageIndex++) {
			const page = await this.#getPage(pageIndex)
			const pageStart = pageIndex * QUERY_PAGE_SIZE
			const sliceStart = Math.max(0, range.start - pageStart)
			const sliceEnd = Math.min(page.length, range.end - pageStart)
			rows.push(...page.slice(sliceStart, sliceEnd))
		}

		return rows
	}

	async *pages(): AsyncIterable<Record<string, unknown>[]> {
		for (let pageIndex = 0; pageIndex < this.#pageCount; pageIndex++) {
			yield await this.#getPage(pageIndex)
		}
	}

	async #getPage(pageIndex: number): Promise<Record<string, unknown>[]> {
		const cached = this.#pages.get(pageIndex)
		if (cached) {
			this.#pages.delete(pageIndex)
			this.#pages.set(pageIndex, cached)
			return cached
		}

		const data = await this.#fetchPage(pageIndex)
		const rows = parseQueryRows(data, this.#columns)
		this.#remember(pageIndex, rows)
		return rows
	}

	#remember(pageIndex: number, rows: Record<string, unknown>[]): void {
		this.#pages.delete(pageIndex)
		this.#pages.set(pageIndex, rows)
		while (this.#pages.size > this.#cacheLimit) {
			const oldestPage = this.#pages.keys().next().value
			if (oldestPage === undefined) break
			this.#pages.delete(oldestPage)
		}
	}
}

/**
 * Materialize every row of a query result. Streaming adapters return only the
 * first page in `rows` and the rest behind `rowSource`; callers that genuinely
 * need the whole set (exports, copy, non-windowed consumers) go through here
 * instead of reading `rows` directly.
 */
export async function collectQueryRows(result: {
	rows: Record<string, unknown>[]
	rowSource?: QueryRowSource
}): Promise<Record<string, unknown>[]> {
	if (!result.rowSource) return result.rows

	const rows: Record<string, unknown>[] = []
	for await (const page of result.rowSource.pages()) rows.push(...page)
	return rows
}

export function parseQueryRows(
	data: JsonValue | null,
	columns: ColumnDefinition[]
): Record<string, unknown>[] {
	if (!Array.isArray(data)) return []

	return data.map((row) => {
		if (isRecord(row) && !Array.isArray(row)) return row
		if (!Array.isArray(row)) return {}

		const record: Record<string, unknown> = {}
		columns.forEach((column, index) => {
			record[column.name] = row[index] !== undefined ? row[index] : null
		})
		return record
	})
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
