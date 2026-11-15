import { memo, type ComponentType } from 'react'

type Closable = {
	open: boolean
}

/**
 * @name memoWhileClosed
 * @description Memoizes a dialog, menu or panel so it does not re-render while
 * it is closed, whatever else its props do. It renders again with the current
 * props the moment `open` turns true, and on every prop change while open. Use
 * it for surfaces that take per-table data: a table switch then leaves every
 * closed one alone.
 *
 * @example
 * const QuietDropTableDialog = memoWhileClosed(DropTableDialog)
 * <QuietDropTableDialog open={isOpen} tableName={tableName} onConfirm={dropTable} />
 */
export function memoWhileClosed<Props extends Closable>(Component: ComponentType<Props>) {
	return memo(Component, function staysClosed(previous, next) {
		return !previous.open && !next.open
	})
}
