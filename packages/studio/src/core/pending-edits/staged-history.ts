export type PendingEdit = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	oldValue: unknown
	newValue: unknown
}

export type StagedChange = {
	key: string
	before: PendingEdit | null
	after: PendingEdit | null
}

export type StagedEntry = {
	tableId: string
	changes: StagedChange[]
}

export type StagedState = {
	pendingEdits: Map<string, PendingEdit>
	undoStack: StagedEntry[]
	redoStack: StagedEntry[]
}

export type StagedCellPatch = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	value: unknown
}

export type StagedStep = {
	state: StagedState
	entry: StagedEntry | null
}

/**
 * @name createEditKey
 * @description Builds the key of a staged edit: table, primary key value and
 * column. Every staged edit is addressed by this key and nothing else.
 *
 * @example
 * createEditKey('users', 7, 'email') // 'users:7:email'
 */
export function createEditKey(
	tableId: string,
	primaryKeyValue: unknown,
	columnName: string
): string {
	return `${tableId}:${String(primaryKeyValue)}:${columnName}`
}

function isTableKey(key: string, tableId: string): boolean {
	return key.startsWith(tableId + ':')
}

function record(state: StagedState, tableId: string, changes: StagedChange[]): StagedState {
	if (changes.length === 0) return state
	const pendingEdits = new Map(state.pendingEdits)
	for (const change of changes) {
		if (change.after) pendingEdits.set(change.key, change.after)
		else pendingEdits.delete(change.key)
	}
	return {
		pendingEdits,
		undoStack: [...state.undoStack, { tableId, changes }],
		redoStack: state.redoStack.filter((entry) => entry.tableId !== tableId)
	}
}

/**
 * @name stageEdits
 * @description Stages edits as one undoable step. Staging over an existing
 * edit replaces it, and any redo history for the table is dropped.
 *
 * @example
 * const next = stageEdits(state, 'users', [edit])
 */
export function stageEdits(state: StagedState, tableId: string, edits: PendingEdit[]): StagedState {
	const changes = edits.map((edit) => {
		const key = createEditKey(tableId, edit.primaryKeyValue, edit.columnName)
		return { key, before: state.pendingEdits.get(key) ?? null, after: edit }
	})
	return record(state, tableId, changes)
}

/**
 * @name revertEdits
 * @description Removes staged edits as one undoable step. Keys that are not
 * staged are ignored.
 *
 * @example
 * const next = revertEdits(state, 'users', [createEditKey('users', 7, 'email')])
 */
export function revertEdits(state: StagedState, tableId: string, keys: string[]): StagedState {
	const changes: StagedChange[] = []
	for (const key of keys) {
		const before = state.pendingEdits.get(key)
		if (before) changes.push({ key, before, after: null })
	}
	return record(state, tableId, changes)
}

/**
 * @name dropEdits
 * @description Removes staged edits without leaving an undo step, for edits
 * the database accepted or the user discarded. Pass no keys to drop every
 * edit of the table. The table's undo and redo history goes with them.
 *
 * @example
 * const next = dropEdits(state, 'users', appliedKeys)
 */
export function dropEdits(state: StagedState, tableId?: string, keys?: string[]): StagedState {
	if (!tableId) return { pendingEdits: new Map(), undoStack: [], redoStack: [] }
	const pendingEdits = new Map(state.pendingEdits)
	const doomed = keys ?? Array.from(pendingEdits.keys()).filter((key) => isTableKey(key, tableId))
	for (const key of doomed) pendingEdits.delete(key)
	return {
		pendingEdits,
		undoStack: state.undoStack.filter((entry) => entry.tableId !== tableId),
		redoStack: state.redoStack.filter((entry) => entry.tableId !== tableId)
	}
}

function findLastIndex(entries: StagedEntry[], tableId: string): number {
	for (let index = entries.length - 1; index >= 0; index--) {
		if (entries[index].tableId === tableId) return index
	}
	return -1
}

/**
 * @name undoStaged
 * @description Undoes the latest staged step of a table and moves it to the
 * redo stack. Returns the step so the caller can repaint the affected cells.
 *
 * @example
 * const { state: next, entry } = undoStaged(state, 'users')
 */
export function undoStaged(state: StagedState, tableId: string): StagedStep {
	const index = findLastIndex(state.undoStack, tableId)
	if (index === -1) return { state, entry: null }
	const entry = state.undoStack[index]
	const pendingEdits = new Map(state.pendingEdits)
	for (const change of entry.changes) {
		if (change.before) pendingEdits.set(change.key, change.before)
		else pendingEdits.delete(change.key)
	}
	return {
		entry,
		state: {
			pendingEdits,
			undoStack: state.undoStack.filter((_, position) => position !== index),
			redoStack: [...state.redoStack, entry]
		}
	}
}

/**
 * @name redoStaged
 * @description Reapplies the latest undone staged step of a table and moves
 * it back to the undo stack.
 *
 * @example
 * const { state: next, entry } = redoStaged(state, 'users')
 */
export function redoStaged(state: StagedState, tableId: string): StagedStep {
	const index = findLastIndex(state.redoStack, tableId)
	if (index === -1) return { state, entry: null }
	const entry = state.redoStack[index]
	const pendingEdits = new Map(state.pendingEdits)
	for (const change of entry.changes) {
		if (change.after) pendingEdits.set(change.key, change.after)
		else pendingEdits.delete(change.key)
	}
	return {
		entry,
		state: {
			pendingEdits,
			undoStack: [...state.undoStack, entry],
			redoStack: state.redoStack.filter((_, position) => position !== index)
		}
	}
}

/**
 * @name getStagedPatches
 * @description Returns the cell values to paint after a staged step was
 * undone or redone. A cell with no staged edit left shows its original value.
 *
 * @example
 * getStagedPatches(entry, 'undo')
 * // [{ primaryKeyColumn: 'id', primaryKeyValue: 7, columnName: 'email', value: 'old@example.com' }]
 */
export function getStagedPatches(
	entry: StagedEntry,
	direction: 'undo' | 'redo'
): StagedCellPatch[] {
	const patches: StagedCellPatch[] = []
	for (const change of entry.changes) {
		const shown = direction === 'undo' ? change.before : change.after
		const other = direction === 'undo' ? change.after : change.before
		const source = shown ?? other
		if (!source) continue
		patches.push({
			primaryKeyColumn: source.primaryKeyColumn,
			primaryKeyValue: source.primaryKeyValue,
			columnName: source.columnName,
			value: shown ? shown.newValue : source.oldValue
		})
	}
	return patches
}

/**
 * @name getRevertPatches
 * @description Returns the original values to paint for staged edits that are
 * being reverted.
 *
 * @example
 * getRevertPatches([edit]) // [{ ..., value: edit.oldValue }]
 */
export function getRevertPatches(edits: PendingEdit[]): StagedCellPatch[] {
	return edits.map((edit) => ({
		primaryKeyColumn: edit.primaryKeyColumn,
		primaryKeyValue: edit.primaryKeyValue,
		columnName: edit.columnName,
		value: edit.oldValue
	}))
}

/**
 * @name applyStagedPatches
 * @description Paints cell patches onto rows, resolving each row by primary
 * key. Rows that are not on the page are left for the overlay to handle.
 *
 * @example
 * const rows = applyStagedPatches(tableData.rows, patches)
 */
export function applyStagedPatches<Row extends Record<string, unknown>>(
	rows: Row[],
	patches: StagedCellPatch[]
): Row[] {
	if (patches.length === 0) return rows
	return rows.map((row) => {
		const matching = patches.filter(
			(patch) => row[patch.primaryKeyColumn] === patch.primaryKeyValue
		)
		if (matching.length === 0) return row
		const patched: Record<string, unknown> = { ...row }
		for (const patch of matching) patched[patch.columnName] = patch.value
		// Safe: `patched` is a copy of `row` with existing columns overwritten.
		return patched as Row
	})
}
