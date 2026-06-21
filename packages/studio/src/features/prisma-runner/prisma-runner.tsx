import { Play, Sparkles, Download, Loader2, Braces, X } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAdapter, useConnections } from '@studio/core/data-provider'
import { getAdapterError } from '@studio/core/data-provider/types'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'
import { ResultsPanel } from '../drizzle-runner/components/results-panel'
import { CodeEditor } from './components/code-editor'
import { SchemaViewer } from './components/schema-viewer'
import type { PrismaRunnerProps, QueryResult, TranslationError } from './types'
import { buildModelMap, tableToModelKey } from './utils/model-mapper'
import { prismaToSql, type Dialect } from './utils/prisma-to-sql'

const EMPTY_SCHEMA: DatabaseSchema = { tables: [], schemas: [], unique_columns: [] }

function deriveDialect(type: string | undefined): Dialect {
	if (type === 'mysql' || type === 'mariadb') return 'mysql'
	if (type === 'sqlite' || type === 'libsql' || type === 'duckdb') return 'sqlite'
	return 'postgresql'
}

export function PrismaRunner({ connectionId }: PrismaRunnerProps) {
	const adapter = useAdapter()
	const { data: connections } = useConnections()
	const [schema, setSchema] = useState<DatabaseSchema>(EMPTY_SCHEMA)
	const [query, setQuery] = useState('')
	const [result, setResult] = useState<QueryResult | null>(null)
	const [isRunning, setIsRunning] = useState(false)
	const [showJson, setShowJson] = useState(false)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
	const [translationError, setTranslationError] = useState<TranslationError | null>(null)

	const activeConnectionId = useMemo(
		function () {
			return connectionId || 'demo-ecommerce-001'
		},
		[connectionId]
	)

	const modelMap = useMemo(
		function () {
			return buildModelMap(schema)
		},
		[schema]
	)

	const dialect = useMemo(
		function () {
			const connection = connections?.find(function (c) {
				return c.id === activeConnectionId
			})
			return deriveDialect(connection?.type)
		},
		[connections, activeConnectionId]
	)

	useEffect(
		function () {
			let cancelled = false
			async function loadSchema() {
				const schemaResult = await adapter.getSchema(activeConnectionId)
				if (cancelled) return
				if (schemaResult.ok && schemaResult.data.tables) {
					setSchema(schemaResult.data)
					const firstTable = schemaResult.data.tables[0]
					if (firstTable) {
						const key = tableToModelKey(firstTable.name)
						setQuery(`prisma.${key}.findMany({ take: 10 })`)
					}
				}
			}
			loadSchema()
			return function () {
				cancelled = true
			}
		},
		[adapter, activeConnectionId]
	)

	const handleExecute = useCallback(
		async function (codeToRun?: string) {
			if (isRunning) return

			const code = codeToRun || query
			const translation = prismaToSql(code, schema, dialect)

			if ('error' in translation) {
				setTranslationError({ error: translation.error, hint: translation.hint })
				return
			}

			setIsRunning(true)
			setResult(null)

			try {
				// The adapter's executeQuery only accepts a SQL string; params are inlined
				// into the SQL by the translator with placeholders, so we send the SQL as-is.
				const queryResult = await adapter.executeQuery(activeConnectionId, translation.sql)
				if (queryResult.ok) {
					setResult(queryResult.data)
					setTranslationError(null)
				} else {
					setResult({
						columns: [],
						rows: [],
						rowCount: 0,
						executionTime: 0,
						error: getAdapterError(queryResult)
					})
				}
			} catch (error) {
				setResult({
					columns: [],
					rows: [],
					rowCount: 0,
					executionTime: 0,
					error: error instanceof Error ? error.message : 'An error occurred'
				})
			} finally {
				setIsRunning(false)
			}
		},
		[adapter, activeConnectionId, query, schema, dialect, isRunning]
	)

	const handleInsert = useCallback(function (text: string) {
		setQuery(function (current) {
			if (!current.trim()) return text
			return current.endsWith('\n') ? `${current}${text}` : `${current}\n${text}`
		})
	}, [])

	const handlePrettify = useCallback(
		function () {
			const lines = query.split('\n')
			const prettified = lines
				.map(function (line) {
					return line.trim()
				})
				.filter(function (line) {
					return line.length > 0
				})
				.join('\n')
			setQuery(prettified)
		},
		[query]
	)

	const handleExport = useCallback(
		function () {
			if (!result || result.rows.length === 0) return

			const jsonString = JSON.stringify(result.rows, null, 2)
			const blob = new Blob([jsonString], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = 'query-results.json'
			a.click()
			URL.revokeObjectURL(url)
		},
		[result]
	)

	return (
		<div className='flex h-full w-full flex-col bg-background overflow-hidden text-sm'>
			<div className='flex h-9 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar px-2'>
				<div className='flex min-w-0 items-center gap-1'>
					<span className='px-2 text-xs font-medium text-muted-foreground'>Prisma</span>

					<Button
						variant='ghost'
						size='icon'
						className='h-8 w-8 rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]'
						onClick={handlePrettify}
						title='Format code (Shift+Alt+F)'
						aria-label='Format code'
					>
						<Sparkles className='h-3.5 w-3.5' />
					</Button>

					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-8 w-8 rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]',
							showJson && 'bg-sidebar-accent text-sidebar-foreground'
						)}
						onClick={function () {
							setShowJson(!showJson)
						}}
						title='Toggle JSON view'
						aria-label='Toggle JSON view'
						aria-pressed={showJson}
					>
						<Braces className='h-3.5 w-3.5' />
					</Button>

					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-8 w-8 rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]',
							(!result || result.rows.length === 0) && 'cursor-not-allowed opacity-45'
						)}
						onClick={handleExport}
						disabled={!result || result.rows.length === 0}
						title='Export results as JSON'
						aria-label='Export results as JSON'
					>
						<Download className='h-3.5 w-3.5' />
					</Button>
				</div>

				<div className='flex shrink-0 items-center gap-1.5'>
					<Button
						size='sm'
						variant='default'
						className='h-7 gap-2 rounded-md px-3 text-xs font-semibold shadow-sm transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90'
						onClick={function () {
							handleExecute()
						}}
						disabled={isRunning}
					>
						{isRunning ? (
							<Loader2 className='h-3.5 w-3.5 animate-spin' />
						) : (
							<Play className='h-3.5 w-3.5 fill-current' />
						)}
						<span>{isRunning ? 'Running…' : 'Run'}</span>
					</Button>

					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]',
							isSidebarCollapsed && 'bg-sidebar-accent'
						)}
						onClick={function () {
							setIsSidebarCollapsed(!isSidebarCollapsed)
						}}
						aria-expanded={!isSidebarCollapsed}
						aria-label={isSidebarCollapsed ? 'Show schema sidebar' : 'Hide schema sidebar'}
					>
						{isSidebarCollapsed ? 'Show Schema' : 'Hide Schema'}
					</Button>
				</div>
			</div>

			<PanelGroup direction='horizontal' className='flex-1'>
				<Panel
					defaultSize={20}
					minSize={15}
					maxSize={40}
					collapsible={true}
					collapsedSize={0}
					onCollapse={function () {
						setIsSidebarCollapsed(true)
					}}
					onExpand={function () {
						setIsSidebarCollapsed(false)
					}}
					className={cn(
						'bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out',
						isSidebarCollapsed && 'hidden'
					)}
				>
					<div className='h-full flex flex-col'>
						<div className='p-3 border-b border-sidebar-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider'>
							Models
						</div>
						<SchemaViewer schema={schema} onInsert={handleInsert} />
					</div>
				</Panel>

				{!isSidebarCollapsed && (
					<PanelResizeHandle className='w-1 bg-transparent hover:bg-primary/20 transition-colors' />
				)}

				<Panel defaultSize={80} minSize={30}>
					<PanelGroup direction='vertical'>
						<Panel defaultSize={60} minSize={20}>
							<div className='flex flex-col h-full relative'>
								<CodeEditor
									value={query}
									onChange={setQuery}
									onExecute={handleExecute}
									isExecuting={isRunning}
									schema={schema}
									modelMap={modelMap}
								/>
							</div>
						</Panel>

						<PanelResizeHandle className='h-1 bg-sidebar-border hover:bg-primary/20 transition-colors' />

						<Panel defaultSize={40} minSize={10}>
							<div className='flex flex-col h-full'>
								{translationError && (
									<div className='flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
										<div className='flex-1 min-w-0'>
											<div className='font-medium text-amber-100'>
												{translationError.error}
											</div>
											{translationError.hint && (
												<div className='mt-0.5 text-amber-200/80'>
													{translationError.hint}
												</div>
											)}
										</div>
										<button
											className='shrink-0 text-amber-200/70 hover:text-amber-100'
											onClick={function () {
												setTranslationError(null)
											}}
											aria-label='Dismiss'
										>
											<X className='h-3.5 w-3.5' />
										</button>
									</div>
								)}
								<div className='flex-1 min-h-0'>
									<ResultsPanel result={result} showJson={showJson} />
								</div>
							</div>
						</Panel>
					</PanelGroup>
				</Panel>
			</PanelGroup>
		</div>
	)
}
