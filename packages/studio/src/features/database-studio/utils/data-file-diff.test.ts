import { describe, expect, it } from 'vitest'
import {
	DATA_FILE_DIFF_ROW_LIMIT,
	buildDescribeDataFileQuery,
	buildMissingDataFileRowsQuery,
	extractDescribedColumns,
	findCommonDataFileColumns,
	findDefaultDataFileKeyIndex,
	selectDataFileDiffDisplayColumns
} from './data-file-diff'

describe('data file follower diff', () => {
	it('prefers a shared User Id column across differently shaped exports', () => {
		const columns = findCommonDataFileColumns(
			['User Id', 'Username', 'Fullname', 'Is verified'],
			['Username', 'Followers', 'USER ID', 'Bio']
		)

		expect(columns).toEqual([
			{ label: 'User Id', olderName: 'User Id', newerName: 'USER ID' },
			{ label: 'Username', olderName: 'Username', newerName: 'Username' }
		])
		expect(findDefaultDataFileKeyIndex(columns)).toBe(0)
	})

	it('builds a bounded anti-join with escaped identifiers', () => {
		const query = buildMissingDataFileRowsQuery('older "followers"', 'newer followers', {
			label: 'User Id',
			olderName: 'User "Id"',
			newerName: 'User Id'
		})

		expect(query).toContain('FROM "older ""followers""" AS older')
		expect(query).toContain('FROM "newer followers" AS newer')
		expect(query).toContain('older."User ""Id"""')
		expect(query).toContain('newer."User Id"')
		expect(query).toContain('NOT EXISTS')
		expect(query).toContain(`LIMIT ${DATA_FILE_DIFF_ROW_LIMIT}`)
	})

	it('extracts DuckDB describe columns and prioritizes follower details', () => {
		const columns = extractDescribedColumns([
			{ column_name: 'User Id', column_type: 'BIGINT' },
			{ column_name: 'Username', column_type: 'VARCHAR' },
			{ column_name: 'Fullname', column_type: 'VARCHAR' }
		])

		expect(columns).toEqual(['User Id', 'Username', 'Fullname'])
		expect(
			selectDataFileDiffDisplayColumns(
				['Avatar URL', 'Fullname', 'Username', 'User Id', 'Profile URL'],
				'User Id'
			)
		).toEqual(['User Id', 'Username', 'Fullname', 'Profile URL', 'Avatar URL'])
	})

	it('quotes the view used for schema discovery', () => {
		expect(buildDescribeDataFileQuery('followers "old"')).toBe(
			'DESCRIBE SELECT * FROM "followers ""old"""'
		)
	})
})
