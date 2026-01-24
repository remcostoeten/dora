import { commands, JsonValue } from '@/lib/bindings'
import type { SqlQueryResult } from './types'

export async function executeSqlQuery(
	connectionId: string,
	query: string
): Promise<SqlQueryResult> {
	console.log('[SQL Console API] Executing query:', query)
	const startTime = performance.now()
	try {
		const startResult = await commands.startQuery(connectionId, query)
		console.log('[SQL Console API] startQuery result:', startResult)

		if (startResult.status !== 'ok') {
			throw new Error('Failed to start query: ' + JSON.stringify(startResult.error))
		}

		if (!startResult.data || startResult.data.length === 0) {
			throw new Error('Failed to start query: no query ID returned')
		}

		const queryId = startResult.data[0]
		console.log('[SQL Console API] queryId:', queryId)

		// Poll for query completion - backend may return "Running" initially
		let pageInfo
		let attempts = 0
		const maxAttempts = 50 // 5 seconds max with 100ms intervals

		while (attempts < maxAttempts) {
			const fetchResult = await commands.fetchQuery(queryId)
			console.log(
				'[SQL Console API] fetchQuery attempt',
				attempts,
				'status:',
				fetchResult.status
			)

			if (fetchResult.status !== 'ok') {
				throw new Error('Failed to fetch query results')
			}

			pageInfo = fetchResult.data

			// Check if query is complete
			if (pageInfo.status === 'Completed' || pageInfo.status === 'Error') {
				console.log('[SQL Console API] Query completed with status:', pageInfo.status)
				break
			}

			// Query still running, wait and retry
			console.log('[SQL Console API] Query still running, waiting...')
			await new Promise((resolve) => setTimeout(resolve, 100))
			attempts++
		}

		if (!pageInfo) {
			throw new Error('Query timed out')
		}

		console.log('[SQL Console API] pageInfo:', pageInfo)
		console.log('[SQL Console API] first_page:', pageInfo.first_page)

		// Handle query error
		if (pageInfo.status === 'Error') {
			return {
				columns: [],
				rows: [],
				rowCount: 0,
				executionTime: Math.round(performance.now() - startTime),
				error: pageInfo.error ?? 'Query failed',
				queryType: getQueryType(query)
			}
		}

		const columnsResult = await commands.getColumns(queryId)
		console.log('[SQL Console API] columnsResult:', columnsResult)

		const columns =
			columnsResult.status === 'ok' && Array.isArray(columnsResult.data)
				? columnsResult.data.map((col: any) => {
						if (typeof col === 'string') {
							return col
						}
						return col.name
					})
				: []

		const rows: Record<string, unknown>[] = Array.isArray(pageInfo.first_page)
			? pageInfo.first_page.map((row): Record<string, unknown> => {
					if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
						return row as Record<string, unknown>
					}
					if (Array.isArray(row)) {
						const rowObj: Record<string, unknown> = {}
						columns.forEach((colName, colIdx) => {
							rowObj[colName] = row[colIdx] !== undefined ? row[colIdx] : null
						})
						return rowObj
					}
					return {}
				})
			: []

		console.log('[SQL Console API] Transformed rows:', rows)
		console.log('[SQL Console API] Transformed columns:', columns)

		const result = {
			columns: columns.map((c) => c.name),
			rows,
			rowCount: pageInfo.affected_rows ?? rows.length,
			executionTime: Math.round(performance.now() - startTime),
			error: undefined,
			queryType: getQueryType(query)
		}
		console.log('[SQL Console API] Final result:', result)
		return result
	} catch (error) {
		console.error('[SQL Console API] Error:', error)
		return {
			columns: [],
			rows: [],
			rowCount: 0,
			executionTime: Math.round(performance.now() - startTime),
			error: error instanceof Error ? error.message : 'Unknown error',
			queryType: 'OTHER'
		}
	}
}

function getQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
	const trimmed = query.trim().toUpperCase()
	if (trimmed.startsWith('SELECT')) return 'SELECT'
	if (trimmed.startsWith('INSERT')) return 'INSERT'
	if (trimmed.startsWith('UPDATE')) return 'UPDATE'
	if (trimmed.startsWith('DELETE')) return 'DELETE'
	return 'OTHER'
}

export async function getSnippets(connectionId: string | null): Promise<any[]> {
	const result = await commands.getScripts(connectionId)
	if (result.status === 'ok') {
		return result.data.map((script: any) => ({
			id: script.id.toString(),
			name: script.name,
			content: script.query_text,
			createdAt: new Date(script.created_at),
			updatedAt: new Date(script.updated_at),
			isFolder: false,
			parentId: null
		}))
	}
	return []
}

export async function saveSnippet(
	name: string,
	content: string,
	connectionId: string | null,
	description: string | null = null
): Promise<void> {
	const result = await commands.saveScript(name, content, connectionId, description)
	if (result.status === 'error') {
		throw new Error(result.error as string)
	}
}

export async function updateSnippet(
	id: number,
	name: string,
	content: string,
	connectionId: string | null,
	description: string | null = null
): Promise<void> {
	const result = await commands.updateScript(id, name, content, connectionId, description)
	if (result.status === 'error') {
		throw new Error(result.error as string)
	}
}

export async function deleteSnippet(id: number): Promise<void> {
	const result = await commands.deleteScript(id)
	if (result.status === 'error') {
		throw new Error(result.error as string)
	}
}
