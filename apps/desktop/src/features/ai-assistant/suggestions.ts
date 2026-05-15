type SchemaTableLite = {
	name: string
	schema?: string
	columns?: Array<{ name: string; data_type: string }>
}

const GENERIC_SUGGESTIONS = [
	'Show me 10 rows from any non-empty table',
	'Explain this database schema',
	'Find tables that look like they store user accounts',
	'Suggest indexes that would speed up common queries',
	'Generate seed data for the largest table',
	'Help me write a JOIN across two tables'
]

const QUICK_ACTIONS = [
	{ label: 'Seed data', prompt: 'Generate 10 realistic INSERT statements for the most important table.' },
	{ label: 'Schema design', prompt: 'Review my schema and suggest design improvements.' },
	{ label: 'Debug SQL error', prompt: 'I have a SQL error. Help me debug it: ' },
	{ label: 'Optimize query', prompt: 'How can I make this query faster? ' }
]

export function buildDynamicSuggestions(tables: SchemaTableLite[]): string[] {
	if (!tables || tables.length === 0) return GENERIC_SUGGESTIONS

	const out: string[] = []
	const first = tables[0]
	const firstName = qualified(first)

	out.push(`SELECT * FROM ${firstName} LIMIT 10`)

	if (tables.length > 1) {
		out.push(
			`Compare row counts across ${tables
				.slice(0, 3)
				.map(qualified)
				.join(', ')}`
		)
	}

	out.push(`Insert one row of realistic fake data into ${firstName}`)

	const emailCol = findColumn(tables, /email/i)
	if (emailCol) {
		out.push(`Find duplicate values in ${qualified(emailCol.table)}.${emailCol.column}`)
	} else {
		out.push('Find duplicate rows in the largest table')
	}

	const textCol = findColumn(tables, /^(varchar|text|character)/i, 'data_type')
	if (textCol) {
		out.push(
			`Suggest an index on ${qualified(textCol.table)}.${textCol.column} and explain the trade-off`
		)
	} else {
		out.push('Suggest one index that would improve a common SELECT')
	}

	if (tables.length >= 2) {
		out.push(`Write a JOIN between ${qualified(tables[0])} and ${qualified(tables[1])}`)
	}

	return out.slice(0, 6)
}

export function getQuickActions() {
	return QUICK_ACTIONS
}

function qualified(table: SchemaTableLite): string {
	const schema = table.schema
	if (!schema || schema === 'public') return table.name
	return `${schema}.${table.name}`
}

function findColumn(
	tables: SchemaTableLite[],
	pattern: RegExp,
	field: 'name' | 'data_type' = 'name'
): { table: SchemaTableLite; column: string } | null {
	for (const table of tables) {
		if (!table.columns) continue
		for (const column of table.columns) {
			if (pattern.test(column[field])) return { table, column: column.name }
		}
	}
	return null
}
