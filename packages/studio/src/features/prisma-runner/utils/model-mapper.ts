import type { DatabaseSchema } from '@studio/lib/bindings'

export type ModelMap = Record<string, string>

function singularize(word: string): string {
	if (word.length > 1 && word.endsWith('s') && !word.endsWith('ss')) {
		return word.slice(0, -1)
	}
	return word
}

function splitWords(table: string): string[] {
	return singularize(table)
		.split('_')
		.filter(function (part) {
			return part.length > 0
		})
}

export function tableToModelKey(table: string): string {
	const words = splitWords(table)
	if (words.length === 0) return ''
	return words
		.map(function (word, index) {
			const lower = word.toLowerCase()
			if (index === 0) return lower
			return lower.charAt(0).toUpperCase() + lower.slice(1)
		})
		.join('')
}

export function tableToModelName(table: string): string {
	const words = splitWords(table)
	return words
		.map(function (word) {
			const lower = word.toLowerCase()
			return lower.charAt(0).toUpperCase() + lower.slice(1)
		})
		.join('')
}

export function buildModelMap(schema: DatabaseSchema): ModelMap {
	const map: ModelMap = {}
	for (const table of schema.tables) {
		map[tableToModelKey(table.name)] = table.name
	}
	return map
}

export function modelKeyToTable(modelKey: string, schema: DatabaseSchema): string | null {
	for (const table of schema.tables) {
		if (tableToModelKey(table.name) === modelKey) return table.name
	}
	return null
}
