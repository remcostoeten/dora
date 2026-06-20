/**
 * Schema diff result types — the FROZEN contract Wave C (migration gen) and
 * Wave D (cockpit UI) import. Produced by `diffSchema(from, to)` where
 * `from` = current/live schema and `to` = desired/code schema.
 *
 * Every change carries a `Confidence` so downstream consumers can surface
 * safe/review/destructive operations differently (e.g. require confirmation
 * before applying a destructive migration). Do not redefine these shapes
 * downstream — import them from here.
 */

import type { ColumnIR, ForeignKeyIR, IndexIR } from '@studio/features/orm-cockpit/ir/types'

/**
 * How risky applying a change is.
 * - `safe`       : non-lossy, reversible-ish (add table, add nullable column, add index).
 * - `review`     : intent unclear or possibly lossy (unknown types, default tweaks, lossy type change).
 * - `destructive`: data loss possible (drop table/column, narrowing, add NOT NULL without default).
 */
export type Confidence = 'safe' | 'review' | 'destructive'

export type Change<T> = {
	kind: 'added' | 'removed' | 'changed'
	before?: T
	after?: T
}

export type ColumnDiff = {
	name: string
	kind: 'added' | 'removed' | 'changed'
	before?: ColumnIR
	after?: ColumnIR
	changedFields?: Array<'type' | 'nullable' | 'default' | 'autoIncrement'>
	confidence: Confidence
}

export type TableDiff = {
	name: string
	kind: 'added' | 'removed' | 'changed'
	columns: ColumnDiff[]
	indexes: Change<IndexIR>[]
	foreignKeys: Change<ForeignKeyIR>[]
	confidence: Confidence
}

export type SchemaDiff = {
	tables: TableDiff[]
	hasChanges: boolean
}
