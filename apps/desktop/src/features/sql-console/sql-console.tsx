import { PanelLeft } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAdapter } from "@/core/data-provider/context";
import { useShortcut } from "@/core/shortcuts";
import { ResizablePanels } from "@/features/drizzle-runner/components/resizable-panels";
import type { SavedQuery } from "@/lib/bindings";
import { Button } from "@/shared/ui/button";
import { CheatsheetPanel } from "../../features/drizzle-runner/components/cheatsheet-panel";
import { CodeEditor } from "../../features/drizzle-runner/components/code-editor";
import { DEFAULT_QUERY } from "../../features/drizzle-runner/data";
import { ConsoleToolbar } from "./components/console-toolbar";
import { SqlEditor } from "./components/sql-editor";
import { SqlResults } from "./components/sql-results";
import { UnifiedSidebar } from "./components/unified-sidebar";
import { DEFAULT_SQL } from "./data";
import { SqlQueryResult, ResultViewMode, SqlSnippet, TableInfo } from "./types";

type Props = {
	onToggleSidebar?: () => void
	activeConnectionId?: string
}

export function SqlConsole({ onToggleSidebar, activeConnectionId }: Props) {
	const adapter = useAdapter()
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
	const [tables, setTables] = useState<TableInfo[]>([])

	const loadSnippets = useCallback(async () => {
		const res = await adapter.getScripts(activeConnectionId || null)
		if (res.ok) {
			const mapped: SqlSnippet[] = res.data.map((s: SavedQuery) => ({
				id: s.id.toString(),
				name: s.name,
				content: s.query_text,
				createdAt: new Date(s.created_at),
				updatedAt: new Date(s.updated_at),
				isFolder: false,
				parentId: null
			}))
			setSnippets(mapped)
		}
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
			adapter
				.getSchema(activeConnectionId)
				.then(function (res) {
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

						// Auto-populate queries with first available table from the connected database
						if (mapped.length > 0) {
							const firstTable = mapped[0].name
							setCurrentSqlQuery(`SELECT * FROM ${firstTable} LIMIT 100;`)
							setCurrentDrizzleQuery(`db.select().from(${firstTable}).limit(100);`)
						} else {
							setCurrentSqlQuery(DEFAULT_SQL)
							setCurrentDrizzleQuery(DEFAULT_QUERY)
						}
					}
				})
				.catch(console.error)
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

						setResult({
							columns,
							rows,
							rowCount: res.data.rowCount,
							executionTime: res.data.executionTime || 0,
							queryType: getQueryType(queryToRun),
							columnDefinitions,
							sourceTable: getTableName(queryToRun)
						})
					} else {
						throw new Error(res.error)
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
					} else {
						throw new Error(res.error)
					}
				}
			} catch (error) {
				setResult({
					columns: [],
					rows: [],
					rowCount: 0,
					executionTime: 0,
					error: error instanceof Error ? error.message : 'An error occurred',
					queryType: 'OTHER'
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

	const handleExport = useCallback(() => {
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

			const currentContent = mode === 'sql' ? currentSqlQuery : currentDrizzleQuery
			const name = `Snippet ${snippets.length + 1}`

			try {
				await adapter.saveScript(
					name,
					currentContent ||
						(mode === 'sql' ? '-- New SQL query' : '// New Drizzle query'),
					activeConnectionId,
					null
				)
				await loadSnippets()
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
		(parentId?: string | null) => {
			const newFolder: SqlSnippet = {
				id: `folder-${Date.now()}`,
				name: `New Folder`,
				content: '',
				createdAt: new Date(),
				updatedAt: new Date(),
				isFolder: true,
				parentId: parentId || null
			}
			setSnippets([newFolder, ...snippets])
		},
		[snippets]
	)

	const handleRenameSnippet = useCallback(
		async (id: string, newName: string) => {
			if (!activeConnectionId) return

			const snippet = snippets.find((s) => s.id === id)
			if (snippet && !snippet.isFolder) {
				try {
					await adapter.updateScript(
						parseInt(id),
						newName,
						snippet.content,
						activeConnectionId,
						null
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
			if (!activeConnectionId) return

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

				{/* Main content */}
				<Panel defaultSize={64} minSize={40}>
					<div className='flex flex-col h-full overflow-hidden'>
						{/* Toolbar */}
						<ConsoleToolbar
							mode={mode}
							onModeChange={setMode}
							onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
							onToggleCheatsheet={() => setShowCheatsheet(!showCheatsheet)}
							showLeftSidebar={showLeftSidebar}
							showCheatsheet={showCheatsheet}
							isExecuting={isExecuting}
							onRun={() => handleExecute()}
							onPrettify={handlePrettify}
							onExport={handleExport}
							hasResults={!!result}
							showFilter={showFilter}
							onToggleFilter={() => setShowFilter(!showFilter)}
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
