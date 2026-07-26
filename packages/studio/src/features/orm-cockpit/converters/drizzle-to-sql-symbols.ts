/**
 * Table/column symbol table for a Drizzle snippet: maps the JS identifiers a
 * query refers to (`users`, `users.createdAt`) onto the DB names declared in
 * the table definition (`user`, `created_at`). Only definitions present in the
 * SAME snippet are known — a query-only snippet resolves to the identifier text
 * verbatim, which is the documented behaviour, not an error.
 */

import ts from 'typescript'

export type TableSymbol = {
	table: string
	/** JS property key → DB column name. */
	columns: Map<string, string>
}

const TABLE_BUILDERS = new Set(['pgTable', 'sqliteTable', 'mysqlTable'])

/** Collect `export const users = pgTable('user', { ... })` declarations. */
export function collectTableSymbols(source: ts.SourceFile): Map<string, TableSymbol> {
	const symbols = new Map<string, TableSymbol>()

	source.forEachChild(function (node) {
		if (!ts.isVariableStatement(node)) {
			return
		}
		for (const decl of node.declarationList.declarations) {
			if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
				continue
			}
			const callee = decl.initializer.expression
			if (!ts.isIdentifier(callee) || !TABLE_BUILDERS.has(callee.text)) {
				continue
			}
			if (!ts.isIdentifier(decl.name)) {
				continue
			}
			const args = decl.initializer.arguments
			const tableName = literalString(args[0])
			if (tableName === null) {
				continue
			}
			symbols.set(decl.name.text, {
				table: tableName,
				columns: collectColumns(args[1]),
			})
		}
	})

	return symbols
}

/** True when the snippet declares at least one Drizzle table. */
export function hasTableDefinitions(source: ts.SourceFile): boolean {
	return collectTableSymbols(source).size > 0
}

function collectColumns(arg: ts.Expression | undefined): Map<string, string> {
	const columns = new Map<string, string>()
	if (!arg || !ts.isObjectLiteralExpression(arg)) {
		return columns
	}
	for (const prop of arg.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue
		}
		const key = propertyName(prop.name)
		if (key === null) {
			continue
		}
		columns.set(key, columnDbName(prop.initializer) ?? key)
	}
	return columns
}

function columnDbName(expr: ts.Expression): string | null {
	let current: ts.Expression = expr
	while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
		current = current.expression.expression
	}
	if (!ts.isCallExpression(current)) {
		return null
	}
	return literalString(current.arguments[0])
}

function literalString(node: ts.Expression | undefined): string | null {
	if (!node) {
		return null
	}
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text
	}
	return null
}

function propertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
		return name.text
	}
	return null
}
