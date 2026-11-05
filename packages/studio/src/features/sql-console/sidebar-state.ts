export const DEFAULT_SQL_CONSOLE_SIDEBAR_WIDTH = 256
export const SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD = 150

export function getSqlConsoleSidebarStateForWidth(width: number) {
	return {
		isOpen: width >= SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD,
		width
	}
}

export function getSqlConsoleSidebarWidthOnOpen(width: number) {
	if (width >= SQL_CONSOLE_SIDEBAR_CLOSE_THRESHOLD) {
		return width
	}

	return DEFAULT_SQL_CONSOLE_SIDEBAR_WIDTH
}
