import { PanelLeft } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAdapter } from '@/core/data-provider/context'
import { getAdapterError } from '@/core/data-provider/types'
import { useShortcut } from '@/core/shortcuts'
import { ResizablePanels } from '@/features/drizzle-runner/components/resizable-panels'
import type { SavedQuery } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { CheatsheetPanel } from '../../features/drizzle-runner/components/cheatsheet-panel'
import { CodeEditor } from '../../features/drizzle-runner/components/code-editor'
import { DEFAULT_QUERY } from '../../features/drizzle-runner/data'
import { ConsoleToolbar } from './components/console-toolbar'
import { QueryHistoryPanel } from './components/query-history-panel'
import { SqlEditor } from './components/sql-editor'
import { SqlResults } from './components/sql-results'
import { UnifiedSidebar } from './components/unified-sidebar'
import { DEFAULT_SQL } from './data'
import { useQueryHistory } from './stores/query-history-store'
import { clearTableDataCache } from '@/features/database-studio/database-studio'
import { SqlQueryResult, ResultViewMode, SqlSnippet, TableInfo } from './types'

type Props = {
	onToggleSidebar?: () => void
	activeConnectionId?: string
}

export function SqlConsole({ onToggleSidebar, activeConnectionId }: Props) {
	const adapter = useAdapter()
	const { toast } = useToast()
	const [mode, setMode] = useState<'sql' | 'drizzle'>('sql')
	const [snippets, setSnippets] = useState<SqlSnippet[]>([])
	const [activeSnippetId, setActiveSnippetId] = useState<string | null>('playground')

	// Independent states for each mode
	const [currentSqlQuery, setCurrentSqlQuery] = useState(DEFAULT_SQL)
	const [currentDrizzleQuery, setCurrentDrizzleQuery] = useState(DEFAULT_QUERY)

	const [result, setResult] = useState<SqlQueryResult | null>(null)
	const [isExecuting, setIsExecuting] = useState(false)
	const [viewMode, setViewMode] = useState<ResultViewMode>('table')
	const [showLeftSidebar, setShowLeftSidebar] = useState(true)
	const [showCheatsheet, setShowCheatsheet] = useState(false)
	const [showFilter, setShowFilter] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [tables, setTables] = useState<TableInfo[]>([])

	const { addToHistory } = useQueryHistory()

	const loadSnippets = useCallback(async () => {
		const [scriptsRes, foldersRes] = await Promise.all([
			adapter.getScripts(activeConnectionId || null),
			adapter.getSnippetFolders()
		])

		const newSnippets: SqlSnippet[] = []

		if (foldersRes.ok) {
			foldersRes.data.forEach((f) => {
				newSnippets.push({
					id: `folder-${f.id}`,
					name: f.name,
					content: '',
					createdAt: new Date(f.created_at),
					updatedAt: new Date(f.updated_at),
					isFolder: true,
					parentId: f.parent_id ? `folder-${f.parent_id}` : null
				})
			})
		}

		if (scriptsRes.ok) {
			scriptsRes.data.forEach((s) => {
				// TODO: Backend should support folders for scripts, assuming mapped or separate logic
				// Currently SavedQuery doesn't strictly have parent_id in types but we might need to handle if it did
				// For now assuming scripts are flat or we need to check if SavedQuery has folder_id
				// Wait, SavedQuery type in bindings.ts has NO folder_id or parent_id.
				// So scripts can't be in folders yet? 
				// Ah, updateScript binding shows `folderId` param!
				// saved_query table has folder_id.
				// Bindings for SavedQuery TYPE seem missing folder_id?
				// Let's check bindings.ts again.
				// SavedQuery type: id, name, ..., category, ... NO folder_id.
				// But updateSnippet command takes folderId.
				// Is it mapped to category? Or just missing from SavedQuery struct?
				// Looking at backend code (from audit) might clarify, but bindings is source of truth for frontend.
				// If bindings is missing it, we can't see it.
				// But wait, getSnippets command returns SavedQuery.
				// getScripts returns SavedQuery.
				// Maybe I should use getSnippets if it returns more data? 
				// No, getScripts is what was used.
				// Let's assume for now scripts are root only until we fix bindings type.
				// OR, maybe `category` is used as folder? No, snippet logic usually uses ID relationships.

				// Re-reading bindings.ts:
				// export type SavedQuery = { ... tags, category ... }
				// It DOES NOT have folder_id. 
				// This suggests scripts can't technically be in folders on the frontend-view of the struct yet.
				// However, I need to implement what I can.

				newSnippets.push({
					id: s.id.toString(),
					name: s.name,
					content: s.query_text,
					createdAt: new Date(s.created_at),
					updatedAt: new Date(s.updated_at),
					isFolder: false,
					parentId: s.folder_id ? `folder-${s.folder_id}` : null
				})
			})
		}


		setSnippets(newSnippets)
	}, [adapter, activeConnectionId])


	useEffect(
		function () {
			if (activeConnectionId) {
				loadSnippets().catch(console.error)
			}
		},
		[activeConnectionId, loadSnippets]
	)

	useEffect(
		function () {
			if (!activeConnectionId) {
				setTables([])
				setCurrentSqlQuery(DEFAULT_SQL)
				setCurrentDrizzleQuery(DEFAULT_QUERY)
				return
			}

			let cancelled = false

			async function fetchSchema() {
				try {
					await adapter.connectToDatabase(activeConnectionId!)
					const res = await adapter.getSchema(activeConnectionId!)
					if (cancelled) return
					if (res.ok && res.data.tables) {
						const mapped: TableInfo[] = res.data.tables.map(function (t) {
							return {
								name: t.name,
								type: 'table' as const,
								rowCount: t.row_count_estimate ?? 0,
								columns: t.columns.map(function (c) {
									return {
										name: c.name,
										type: c.data_type,
										nullable: c.is_nullable,
										primaryKey: c.is_primary_key
									}
								})
							}
						})
						setTables(mapped)

						if (mapped.length > 0) {
							const firstTable = mapped[0].name
							setCurrentSqlQuery(`SELECT * FROM ${firstTable} LIMIT 100;`)
							setCurrentDrizzleQuery(`db.select().from(${firstTable}).limit(100);`)
						} else {
							setCurrentSqlQuery(DEFAULT_SQL)
							setCurrentDrizzleQuery(DEFAULT_QUERY)
						}
					}
				} catch (error) {
					if (!cancelled) console.error('Failed to fetch schema:', error)
				}
			}

			fetchSchema()

			return function () {
				cancelled = true
			}
		},
		[activeConnectionId, adapter]
	)

	const handleExecute = useCallback(
		async (codeOverride?: string) => {
			if (isExecuting) return

			setIsExecuting(true)
			setResult(null)

			try {
				if (mode === 'sql') {
					const queryToRun = codeOverride || currentSqlQuery
					if (!activeConnectionId) {
						throw new Error('No connection selected')
					}
					const res = await adapter.executeQuery(activeConnectionId, queryToRun)
					if (res.ok) {
						const columns = Array.isArray(res.data.columns)
							? res.data.columns.map((c: any) => (typeof c === 'string' ? c : c.name))
							: []

						// Extract column definitions if available from adapter
						const columnDefinitions =
							Array.isArray(res.data.columns) &&
								typeof res.data.columns[0] !== 'string'
								? (res.data.columns as any[])
								: undefined

						const rows = Array.isArray(res.data.rows)
							? res.data.rows.map((row: any) => {
								if (
									typeof row === 'object' &&
									row !== null &&
									!Array.isArray(row)
								) {
									return row
								}
								if (Array.isArray(row)) {
									const obj: Record<string, any> = {}
									columns.forEach((col: string, i: number) => {
										obj[col] = row[i]
									})
									return obj
								}
								return {}
							})
							: []

						const queryType = getQueryType(queryToRun)

						setResult({
							columns,
							rows,
							rowCount: res.data.rowCount,
							executionTime: res.data.executionTime || 0,
							queryType,
							columnDefinitions,
							sourceTable: getTableName(queryToRun)
						})

						// Clear table viewer cache so it refetches when user switches to it
						if (queryType !== 'SELECT') {
							clearTableDataCache()
						}

						addToHistory({
							query: queryToRun,
							connectionId: activeConnectionId,
							executionTimeMs: res.data.executionTime || 0,
							success: true,
							rowCount: res.data.rowCount
						})
					} else {
						throw new Error(getAdapterError(res))
					}
				} else {
					const queryToRun = codeOverride || currentDrizzleQuery
					if (!activeConnectionId) {
						throw new Error('No connection selected')
					}

					const res = await adapter.executeQuery(activeConnectionId, queryToRun)

					if (res.ok) {
						setResult({
							columns: res.data.columns,
							rows: res.data.rows,
							rowCount: res.data.rowCount,
							executionTime: res.data.executionTime || 0,
							error: res.data.error,
							queryType: 'SELECT',
							sourceTable: getTableName(queryToRun)
						})

						// Drizzle queries may also mutate data (insert, update, delete)
						const lowerQuery = queryToRun.toLowerCase()
						if (lowerQuery.includes('.insert') || lowerQuery.includes('.update') || lowerQuery.includes('.delete')) {
							clearTableDataCache()
						}
					} else {
						throw new Error(getAdapterError(res))
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'An error occurred'
				setResult({
					columns: [],
					rows: [],
					rowCount: 0,
					executionTime: 0,
					error: errorMsg,
					queryType: 'OTHER'
				})

				addToHistory({
					query: mode === 'sql' ? currentSqlQuery : currentDrizzleQuery,
					connectionId: activeConnectionId || null,
					executionTimeMs: 0,
					success: false,
					error: errorMsg
				})
			} finally {
				setIsExecuting(false)
			}
		},
		[mode, currentSqlQuery, currentDrizzleQuery, isExecuting, activeConnectionId, adapter]
	)

	function getQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
		const trimmed = query.trim().toUpperCase()
		if (trimmed.startsWith('SELECT')) return 'SELECT'
		if (trimmed.startsWith('INSERT')) return 'INSERT'
		if (trimmed.startsWith('UPDATE')) return 'UPDATE'
		if (trimmed.startsWith('DELETE')) return 'DELETE'
		return 'OTHER'
	}

	function getTableName(query: string): string | undefined {
		// Try Drizzle syntax first: db.select().from(users)
		const drizzleMatch = query.match(/\.from\(\s*(\w+)\s*\)/)
		if (drizzleMatch) return drizzleMatch[1]

		// Try SQL syntax: SELECT * FROM users (basic support)
		const sqlMatch = query.match(/FROM\s+["']?(\w+)["']?/i)
		if (sqlMatch) return sqlMatch[1]

		return undefined
	}

	function handlePrettify() {
		if (mode === 'sql') {
			const lines = currentSqlQuery.split('\n')
			const prettified = lines
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
				.join('\n')
			setCurrentSqlQuery(prettified)
		} else {
			const lines = currentDrizzleQuery.split('\n')
			const prettified = lines
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
				.join('\n')
			setCurrentDrizzleQuery(prettified)
		}
	}

	const handleExport = useCallback(function () {
		if (!result || result.rows.length === 0) return

		const jsonString = JSON.stringify(result.rows, null, 2)
		const blob = new Blob([jsonString], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'query-results.json'
		a.click()
		URL.revokeObjectURL(url)
	}, [result])

	const handleExportCsv = useCallback(function () {
		if (!result || result.rows.length === 0) return

		const headers = result.columns.join(',')
		const rows = result.rows.map(function (row) {
			return result.columns.map(function (col) {
				const value = row[col]
				if (value === null || value === undefined) return ''
				const stringValue = String(value)
				if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
					return '"' + stringValue.replace(/"/g, '""') + '"'
				}
				return stringValue
			}).join(',')
		}).join('\n')

		const csvContent = headers + '\n' + rows
		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'query-results.csv'
		a.click()
		URL.revokeObjectURL(url)
	}, [result])

	// Unified snippet handling - works for both SQL and Drizzle
	const handleSnippetSelect = useCallback(
		(id: string) => {
			const snippet = snippets.find((s) => s.id === id)
			if (snippet) {
				setActiveSnippetId(id)
				// Load content into the current mode's editor
				if (mode === 'sql') {
					setCurrentSqlQuery(snippet.content)
				} else {
					setCurrentDrizzleQuery(snippet.content)
				}
			}
		},
		[snippets, mode]
	)

	const handleNewSnippet = useCallback(
		async (parentId?: string | null) => {
			if (!activeConnectionId) return

			let parentFolderId: number | null = null
			if (parentId && parentId.startsWith('folder-')) {
				parentFolderId = parseInt(parentId.replace('folder-', ''), 10)
			}

			const currentContent = mode === 'sql' ? currentSqlQuery : currentDrizzleQuery
			const name = `Snippet ${snippets.length + 1}`

			try {
				const res = await adapter.saveScript(
					name,
					currentContent ||
					(mode === 'sql' ? '-- New SQL query' : '// New Drizzle query'),
					activeConnectionId,
					null,
					parentFolderId
				)
				if (res.ok) {
					await loadSnippets()
				}
			} catch (error) {
				console.error('Failed to save snippet:', error)
			}
		},
		[
			activeConnectionId,
			snippets.length,
			mode,
			currentSqlQuery,
			currentDrizzleQuery,
			adapter,
			loadSnippets
		]
	)


	const handleNewFolder = useCallback(
		async (parentId?: string | null) => {
			// Extract integer ID if parent is a folder
			let parentFolderId: number | null = null
			if (parentId && parentId.startsWith('folder-')) {
				parentFolderId = parseInt(parentId.replace('folder-', ''), 10)
			}

			const name = 'New Folder'
			try {
				const res = await adapter.createSnippetFolder(name, parentFolderId)
				if (res.ok) {
					await loadSnippets()
				}
			} catch (error) {
				console.error('Failed to create folder:', error)
			}
		},
		[adapter, loadSnippets]
	)


	const handleRenameSnippet = useCallback(
		async (id: string, newName: string) => {
			if (!activeConnectionId && !id.startsWith('folder-')) return

			if (id.startsWith('folder-')) {
				const folderId = parseInt(id.replace('folder-', ''), 10)
				try {
					await adapter.updateSnippetFolder(folderId, newName)
					await loadSnippets()
				} catch (error) {
					console.error('Failed to rename folder:', error)
				}
				return
			}

			const snippet = snippets.find((s) => s.id === id)
			if (snippet && !snippet.isFolder) {
				let folderId: number | null = null
				if (snippet.parentId && snippet.parentId.startsWith('folder-')) {
					folderId = parseInt(snippet.parentId.replace('folder-', ''), 10)
				}

				try {
					await adapter.updateScript(
						parseInt(id),
						newName,
						snippet.content,
						activeConnectionId,
						null,
						folderId
					)
					await loadSnippets()
				} catch (error) {
					console.error('Failed to rename snippet:', error)
				}
			}

		},
		[activeConnectionId, snippets, adapter, loadSnippets]
	)


	const handleDeleteSnippet = useCallback(
		async (id: string) => {
			if (!activeConnectionId && !id.startsWith('folder-')) return

			if (id.startsWith('folder-')) {
				const folderId = parseInt(id.replace('folder-', ''), 10)
				try {
					await adapter.deleteSnippetFolder(folderId)
					await loadSnippets()
				} catch (error) {
					console.error('Failed to delete folder:', error)
				}
				return
			}

			try {
				await adapter.deleteScript(parseInt(id))
				await loadSnippets()
			} catch (error) {
				console.error('Failed to delete snippet:', error)
			}
		},
		[activeConnectionId, adapter, loadSnippets]
	)


	function handleTableSelect(tableName: string) {
		if (mode === 'sql') {
			setCurrentSqlQuery(`SELECT * FROM ${tableName} LIMIT 100;`)
		} else {
			setCurrentDrizzleQuery(`db.select().from(${tableName}).limit(100);`)
		}
	}

	const handleInsertSnippet = useCallback(
		(code: string) => {
			if (mode === 'sql') {
				setCurrentSqlQuery((prev) => prev + '\n' + code)
			} else {
				setCurrentDrizzleQuery((prev) => prev + '\n' + code)
			}
		},
		[mode]
	)

	const $ = useShortcut()

	$.key('s')
		.except('typing')
		.on(
			function () {
				setMode('sql')
			},
			{ description: 'Switch to SQL mode' }
		)

	$.key('d')
		.except('typing')
		.on(
			function () {
				setMode('drizzle')
			},
			{ description: 'Switch to Drizzle mode' }
		)

	$.key('h')
		.except('typing')
		.on(
			function () {
				setShowHistory(!showHistory)
			},
			{ description: 'Toggle query history' }
		)

	return (
		<div className='flex h-full w-full bg-background overflow-hidden'>
			<PanelGroup direction='horizontal' className='flex-1'>
				{/* Left sidebar - Query snippets (unified for both modes) */}
				{showLeftSidebar && (
					<>
						<Panel
							defaultSize={18}
							minSize={12}
							maxSize={30}
							collapsible
							onCollapse={() => setShowLeftSidebar(false)}
						>
							<UnifiedSidebar
								tables={tables}
								snippets={snippets}
								activeSnippetId={activeSnippetId}
								onTableSelect={handleTableSelect}
								onInsertQuery={(query) => {
									if (mode === 'sql') {
										setCurrentSqlQuery(query)
									} else {
										setCurrentDrizzleQuery(query)
									}
								}}
								onSnippetSelect={handleSnippetSelect}
								onNewSnippet={handleNewSnippet}
								onNewFolder={handleNewFolder}
								onRenameSnippet={handleRenameSnippet}
								onDeleteSnippet={handleDeleteSnippet}
							/>
						</Panel>
						<PanelResizeHandle className='w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize' />
					</>
				)}

				{showHistory && (
					<>
						<Panel
							defaultSize={15}
							minSize={10}
							maxSize={25}
							collapsible
							onCollapse={function () { setShowHistory(false) }}
						>
							<QueryHistoryPanel
								currentConnectionId={activeConnectionId}
								onSelectQuery={function (query) {
									if (mode === 'sql') {
										setCurrentSqlQuery(query)
									} else {
										setCurrentDrizzleQuery(query)
									}
								}}
							/>
						</Panel>
						<PanelResizeHandle className='w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize' />
					</>
				)}

				{/* Main content */}
				<Panel defaultSize={64} minSize={40}>
					<div className='flex flex-col h-full overflow-hidden'>
						{/* Toolbar */}
						<ConsoleToolbar
							mode={mode}
							onModeChange={setMode}
							onToggleLeftSidebar={function () { setShowLeftSidebar(!showLeftSidebar) }}
							onToggleCheatsheet={function () { setShowCheatsheet(!showCheatsheet) }}
							showLeftSidebar={showLeftSidebar}
							showCheatsheet={showCheatsheet}
							isExecuting={isExecuting}
							onRun={function () { handleExecute() }}
							onPrettify={handlePrettify}
							onExport={handleExport}
							onExportCsv={handleExportCsv}
							hasResults={!!result}
							showFilter={showFilter}
							onToggleFilter={function () {
								toast({
									title: 'Coming Soon',
									description: 'Filter functionality is currently under development.',
									duration: 2000
								})
							}}
							showHistory={showHistory}
							onToggleHistory={function () { setShowHistory(!showHistory) }}
						/>

						{/* Editor and Results */}
						<div className='flex-1 overflow-hidden'>
							<ResizablePanels
								defaultSplit={55}
								minSize={100}
								topPanel={
									<div className='relative w-full h-full'>
										{mode === 'sql' ? (
											<SqlEditor
												value={currentSqlQuery}
												onChange={setCurrentSqlQuery}
												onExecute={(code) => handleExecute(code)}
												isExecuting={isExecuting}
											/>
										) : (
											<CodeEditor
												value={currentDrizzleQuery}
												onChange={setCurrentDrizzleQuery}
												onExecute={function (code) {
													handleExecute(code)
												}}
												isExecuting={isExecuting}
												tables={tables.map(function (t) {
													return {
														name: t.name,
														columns: (t.columns || []).map(
															function (c) {
																return {
																	name: c.name,
																	type: c.type,
																	nullable: c.nullable ?? false,
																	primaryKey:
																		c.primaryKey ?? false
																}
															}
														)
													}
												})}
											/>
										)}
									</div>
								}
								bottomPanel={
									<SqlResults
										result={result}
										viewMode={viewMode}
										onViewModeChange={setViewMode}
										onExport={handleExport}
										connectionId={activeConnectionId}
										showFilter={showFilter}
										onRefresh={() => handleExecute()}
									/>
								}
							/>
						</div>
					</div>
				</Panel>

				{/* Cheatsheet Panel */}
				{showCheatsheet && (
					<>
						<PanelResizeHandle className='w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize' />
						<Panel
							defaultSize={20}
							minSize={15}
							maxSize={35}
							collapsible
							onCollapse={() => setShowCheatsheet(false)}
						>
							<CheatsheetPanel
								isOpen={showCheatsheet}
								onToggle={() => setShowCheatsheet(!showCheatsheet)}
								onInsertSnippet={handleInsertSnippet}
							/>
						</Panel>
					</>
				)}
			</PanelGroup>
		</div>
	)
}
