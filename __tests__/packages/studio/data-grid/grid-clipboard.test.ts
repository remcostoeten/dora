import { describe, expect, it } from 'vitest'
import {
	getCellsToClear,
	parseClipboardGrid
} from '@studio/features/database-studio/components/data-grid/grid-clipboard'

describe('parseClipboardGrid', function () {
	it('splits LF-delimited TSV into rows and cells', function () {
		expect(parseClipboardGrid('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('strips CRLF line endings so no \\r lands in cell values', function () {
		expect(parseClipboardGrid('a\tb\r\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('handles bare CR line endings', function () {
		expect(parseClipboardGrid('a\tb\rc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('drops the single trailing newline instead of producing a phantom row', function () {
		expect(parseClipboardGrid('a\tb\n')).toEqual([['a', 'b']])
		expect(parseClipboardGrid('a\tb\r\n')).toEqual([['a', 'b']])
	})

	it('keeps interior blank lines positional', function () {
		expect(parseClipboardGrid('a\n\nb')).toEqual([['a'], [''], ['b']])
	})

	it('keeps a deliberate empty trailing cell', function () {
		expect(parseClipboardGrid('a\t')).toEqual([['a', '']])
	})
})

describe('getCellsToClear', function () {
	it('falls back to the focused cell when there is no selection', function () {
		expect(getCellsToClear(new Set(), { row: 2, col: 3 })).toEqual([{ row: 2, col: 3 }])
	})

	it('returns every selected cell when there is a selection', function () {
		expect(getCellsToClear(new Set(['0:1', '1:2']), { row: 0, col: 0 })).toEqual([
			{ row: 0, col: 1 },
			{ row: 1, col: 2 }
		])
	})
})
