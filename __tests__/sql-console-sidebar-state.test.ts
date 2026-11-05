import { describe, expect, it } from 'vitest'

import {
	DEFAULT_SQL_CONSOLE_SIDEBAR_WIDTH,
	SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD,
	getSqlConsoleSidebarStateForWidth,
	getSqlConsoleSidebarWidthOnOpen
} from '@studio/features/sql-console/sidebar-state'

describe('sql console sidebar state', function () {
	it('marks the sidebar closed once the resize width drops below the close threshold', function () {
		expect(getSqlConsoleSidebarStateForWidth(SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD - 1)).toEqual({
			isOpen: false,
			width: SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD - 1
		})
	})

	it('keeps the sidebar open at and above the close threshold', function () {
		expect(getSqlConsoleSidebarStateForWidth(SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD)).toEqual({
			isOpen: true,
			width: SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD
		})
	})

	it('restores the default width when reopening from a collapsed resize width', function () {
		expect(getSqlConsoleSidebarWidthOnOpen(SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD - 1)).toBe(
			DEFAULT_SQL_CONSOLE_SIDEBAR_WIDTH
		)
	})
})
