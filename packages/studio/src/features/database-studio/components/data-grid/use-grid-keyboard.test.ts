import { describe, expect, it } from 'vitest'
import { parseClipboardGrid } from './use-grid-keyboard'

describe('parseClipboardGrid', () => {
	it('splits LF-delimited TSV into rows and cells', () => {
		expect(parseClipboardGrid('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('strips CRLF line endings so no \\r lands in cell values', () => {
		expect(parseClipboardGrid('a\tb\r\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('handles bare CR line endings', () => {
		expect(parseClipboardGrid('a\tb\rc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		])
	})

	it('drops the single trailing newline instead of producing a phantom row', () => {
		expect(parseClipboardGrid('a\tb\n')).toEqual([['a', 'b']])
		expect(parseClipboardGrid('a\tb\r\n')).toEqual([['a', 'b']])
	})

	it('keeps interior blank lines positional', () => {
		expect(parseClipboardGrid('a\n\nb')).toEqual([['a'], [''], ['b']])
	})

	it('keeps a deliberate empty trailing cell', () => {
		expect(parseClipboardGrid('a\t')).toEqual([['a', '']])
	})
})
