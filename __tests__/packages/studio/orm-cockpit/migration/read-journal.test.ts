import { describe, expect, it } from 'vitest'
import {
	parseJournal,
	extractOutDir,
	readJournalWithReader,
} from '@studio/features/orm-cockpit/migration/read-journal'
import type { ProjectReader } from '@studio/features/orm-cockpit/link/detect-orm'

const JOURNAL = JSON.stringify({
	version: '7',
	dialect: 'postgresql',
	entries: [
		{ idx: 1, version: '7', when: 2000, tag: '0001_add_users', breakpoints: true },
		{ idx: 0, version: '7', when: 1000, tag: '0000_init', breakpoints: true },
	],
})

describe('parseJournal', function () {
	it('parses entries and sorts them by idx', function () {
		const entries = parseJournal(JOURNAL)
		expect(entries.map((e) => e.tag)).toEqual(['0000_init', '0001_add_users'])
		expect(entries.map((e) => e.when)).toEqual([1000, 2000])
	})

	it('returns [] on malformed JSON', function () {
		expect(parseJournal('{ not json')).toEqual([])
	})

	it('skips entries missing required fields', function () {
		const text = JSON.stringify({ entries: [{ idx: 0, tag: 'x' }, { when: 5 }] })
		expect(parseJournal(text)).toEqual([])
	})
})

describe('extractOutDir', function () {
	it('defaults to drizzle when no config / no out', function () {
		expect(extractOutDir(null)).toBe('drizzle')
		expect(extractOutDir('export default {}')).toBe('drizzle')
	})

	it('reads a custom out dir and strips ./ and trailing slash', function () {
		expect(extractOutDir(`export default { out: './db/migrations/' }`)).toBe('db/migrations')
	})
})

describe('readJournalWithReader', function () {
	function reader(files: Record<string, string>): ProjectReader {
		return {
			async readFile(path) {
				return files[path] ?? null
			},
			async listDir() {
				return []
			},
		}
	}

	it('reads the journal at the default out dir', async function () {
		const r = reader({ '/proj/drizzle/meta/_journal.json': JOURNAL })
		const result = await readJournalWithReader('/proj', null, r)
		expect(result.journalPath).toBe('/proj/drizzle/meta/_journal.json')
		expect(result.entries).toHaveLength(2)
	})

	it('honors a custom out dir from config text', async function () {
		const r = reader({ '/proj/db/migrations/meta/_journal.json': JOURNAL })
		const result = await readJournalWithReader('/proj', `{ out: './db/migrations' }`, r)
		expect(result.entries).toHaveLength(2)
	})

	it('returns empty when no journal exists', async function () {
		const result = await readJournalWithReader('/proj', null, reader({}))
		expect(result).toEqual({ entries: [], journalPath: null })
	})
})
