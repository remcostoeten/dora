import type { PaginationState } from '../types'

/**
 * @name getPagedOffset
 * @description Returns the offset of the next or previous page of results.
 * It stays on the current offset when there is no page in that direction.
 *
 * @example
 * getPagedOffset({ limit: 50, offset: 50 }, 'next', 120) // 100
 */
export function getPagedOffset(
	pagination: PaginationState,
	direction: 'next' | 'prev',
	totalCount: number
): number {
	if (direction === 'prev') return Math.max(0, pagination.offset - pagination.limit)
	const next = pagination.offset + pagination.limit
	return next < totalCount ? next : pagination.offset
}

/**
 * @name getOffsetForRow
 * @description Returns the offset of the page that holds an absolute,
 * zero-based row index.
 *
 * @example
 * getOffsetForRow(119, 50) // 100
 */
export function getOffsetForRow(absoluteRowIndex: number, limit: number): number {
	return Math.floor(absoluteRowIndex / limit) * limit
}
