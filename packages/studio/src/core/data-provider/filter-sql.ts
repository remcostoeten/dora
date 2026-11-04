import type {
	FilterCondition,
	FilterConjunction,
	FilterDescriptor,
	FilterGroup,
	FilterOperator
} from '@studio/features/database-studio/types'
import { isFilterGroup } from '@studio/features/database-studio/types'

/** Maps a filter operator to its SQL representation. */
export function operatorToSql(op: FilterOperator | string): string {
	const map: Record<string, string> = {
		eq: '=',
		neq: '!=',
		gt: '>',
		gte: '>=',
		lt: '<',
		lte: '<=',
		ilike: 'ILIKE',
		contains: 'LIKE'
	}
	return map[op] || '='
}

/** Builds the SQL condition for a single filter, with the value escaped. */
export function buildFilterCondition(filter: FilterDescriptor): string {
	const sqlOp = operatorToSql(filter.operator)
	const escapedValue = String(filter.value).replace(/'/g, "''")
	if (filter.operator === 'contains' || filter.operator === 'ilike') {
		return `"${filter.column}" ${sqlOp} '%${escapedValue}%'`
	}
	return `"${filter.column}" ${sqlOp} '${escapedValue}'`
}

/**
 * Builds a WHERE clause body (without the leading `WHERE`) from a flat list of
 * filters joined by the given conjunction. Returns an empty string when there
 * are no filters.
 */
export function buildWhereClause(
	filters: FilterDescriptor[] | undefined,
	conjunction: FilterConjunction = 'AND'
): string {
	if (!filters || filters.length === 0) return ''
	return filters.map(buildFilterCondition).join(` ${conjunction} `)
}

/** Returns true when a leaf condition is complete enough to emit SQL. */
function isUsableCondition(node: FilterCondition): boolean {
	return Boolean(node.column) && Boolean(node.operator) && String(node.value ?? '') !== ''
}

/**
 * Builds a parenthesised WHERE clause body (without the leading `WHERE`) from a
 * structured {@link FilterGroup}, recursing over nested groups. Empty groups and
 * incomplete conditions are skipped. Value escaping reuses
 * {@link buildFilterCondition}, exactly mirroring the flat-list path, so no new
 * (less safe) escaping is introduced.
 */
export function buildWhereClauseFromGroup(group: FilterGroup | undefined): string {
	if (!group) return ''
	const parts: string[] = []
	for (const node of group.conditions) {
		if (isFilterGroup(node)) {
			const nested = buildWhereClauseFromGroup(node)
			if (nested) parts.push(`(${nested})`)
		} else if (isUsableCondition(node)) {
			parts.push(buildFilterCondition(node))
		}
	}
	return parts.join(` ${group.logic} `)
}

/**
 * Backward-compatible bridge: builds a WHERE clause body from either a
 * structured group (preferred) or a legacy flat filter list. When a group is
 * provided it takes precedence.
 */
export function buildWhereClauseFrom(
	group: FilterGroup | undefined,
	filters: FilterDescriptor[] | undefined,
	conjunction: FilterConjunction = 'AND'
): string {
	if (group && group.conditions.length > 0) return buildWhereClauseFromGroup(group)
	return buildWhereClause(filters, conjunction)
}

/**
 * Lifts a legacy flat filter list into the root {@link FilterGroup} model so the
 * rest of the app can work with a single representation. Persisted flat lists
 * (#98) remain readable through this.
 */
export function flatFiltersToGroup(
	filters: FilterDescriptor[] | undefined,
	conjunction: FilterConjunction = 'AND'
): FilterGroup {
	return {
		logic: conjunction,
		conditions: (filters ?? []).map(function (f) {
			return { column: f.column, operator: f.operator, value: f.value }
		})
	}
}

/**
 * Flattens the root group back to a legacy flat filter list, ignoring nested
 * groups. Used to keep the old `filters`/`conjunction` props populated for any
 * consumer (or persisted state) that still reads them.
 */
export function groupToFlatFilters(group: FilterGroup | undefined): {
	filters: FilterDescriptor[]
	conjunction: FilterConjunction
} {
	if (!group) return { filters: [], conjunction: 'AND' }
	const filters: FilterDescriptor[] = []
	for (const node of group.conditions) {
		if (!isFilterGroup(node)) {
			filters.push({ column: node.column, operator: node.operator, value: node.value })
		}
	}
	return { filters, conjunction: group.logic }
}
