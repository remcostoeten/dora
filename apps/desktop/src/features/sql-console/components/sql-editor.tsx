import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { initVimMode } from 'monaco-vim'
import { useRef, useEffect, useState } from 'react'
import { useSetting } from '@/core/settings'
import { loadTheme, isBuiltinTheme, MonacoTheme } from '@/core/settings/editor-themes'
import type { TableInfo } from '../types'
import { usePromotionalDemo } from '../hooks/use-promotional-demo'

type Props = {
	value: string
	onChange: (value: string) => void
	onExecute: (sql?: string) => void
	isExecuting: boolean
	tables: TableInfo[]
}

const SQL_KEYWORDS = [
	'SELECT',
	'FROM',
	'WHERE',
	'JOIN',
	'LEFT JOIN',
	'RIGHT JOIN',
	'INNER JOIN',
	'OUTER JOIN',
	'ON',
	'INSERT INTO',
	'VALUES',
	'UPDATE',
	'SET',
	'DELETE',
	'CREATE TABLE',
	'ALTER TABLE',
	'DROP TABLE',
	'ORDER BY',
	'GROUP BY',
	'HAVING',
	'LIMIT',
	'OFFSET',
	'DISTINCT',
	'AS',
	'AND',
	'OR',
	'NOT',
	'IN',
	'LIKE',
	'IS NULL',
	'IS NOT NULL',
	'COUNT',
	'SUM',
	'AVG',
	'MIN',
	'MAX'
]

type EditorRef = Parameters<OnMount>[0]
type MonacoApi = Parameters<OnMount>[1]

function getAliases(text: string): Map<string, string> {
	const aliases = new Map<string, string>()
	const regex =
		/\b(?:from|join|update|into)\s+([a-zA-Z_][\w$]*)(?:\s+(?:as\s+)?([a-zA-Z_][\w$]*))?/gi

	for (const match of text.matchAll(regex)) {
		const table = match[1]
		const alias = match[2]
		aliases.set(table.toLowerCase(), table.toLowerCase())
		if (alias) aliases.set(alias.toLowerCase(), table.toLowerCase())
	}

	return aliases
}

function getFromClauseTables(text: string): Set<string> {
	const tables = new Set<string>()
	const regex = /\b(?:from|join|update|into)\s+([a-zA-Z_][\w$]*)/gi
	for (const match of text.matchAll(regex)) {
		tables.add(match[1].toLowerCase())
	}
	return tables
}

function columnDetail(col: NonNullable<import('../types').TableInfo['columns']>[number]): string {
	const parts: string[] = [col.type]
	if (col.primaryKey) parts.push('PK')
	if (col.nullable === false) parts.push('NOT NULL')
	return parts.join(' · ')
}

const TRIGGER_SUGGEST = { id: 'editor.action.triggerSuggest', title: '' }

function getNextStepKeywords(beforeLower: string): string[] {
	// after FROM tablename → filter/sort/join options
	if (/\bfrom\s+\w+\s*$/.test(beforeLower)) {
		return ['WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ORDER BY', 'GROUP BY', 'LIMIT', 'HAVING', 'AS']
	}
	// after JOIN tablename → ON
	if (/\b(?:join|left join|right join|inner join|outer join)\s+\w+\s*$/.test(beforeLower)) {
		return ['ON']
	}
	// after ON col = col → chained joins or filters
	if (/\bon\s+[\w.]+\s*=\s*[\w.]+\s*$/.test(beforeLower)) {
		return ['WHERE', 'JOIN', 'LEFT JOIN', 'AND', 'ORDER BY', 'GROUP BY', 'LIMIT']
	}
	// after WHERE / AND / OR condition
	if (/\b(?:where|and|or)\s+[\w.]+\s*(?:=|!=|<>|>|<|>=|<=|like|in|is)\s*[\w.'%]*\s*$/.test(beforeLower)) {
		return ['AND', 'OR', 'ORDER BY', 'GROUP BY', 'LIMIT']
	}
	// after ORDER BY col
	if (/\border\s+by\s+[\w.]+\s*$/.test(beforeLower)) {
		return ['ASC', 'DESC', 'LIMIT', ',']
	}
	// after ASC / DESC
	if (/\b(?:asc|desc)\s*$/.test(beforeLower)) {
		return ['LIMIT', ',', 'NULLS FIRST', 'NULLS LAST']
	}
	// after GROUP BY col
	if (/\bgroup\s+by\s+[\w.]+\s*$/.test(beforeLower)) {
		return ['HAVING', 'ORDER BY', 'LIMIT', ',']
	}
	// after HAVING condition
	if (/\bhaving\s+.+\s*$/.test(beforeLower)) {
		return ['ORDER BY', 'LIMIT']
	}
	return []
}

export function SqlEditor({ value, onChange, onExecute, isExecuting, tables }: Props) {
	const [editorFontSize] = useSetting('editorFontSize')
	const [editorThemeSetting] = useSetting('editorTheme')
	const [enableVimMode] = useSetting('enableVimMode')
	const [isEditorReady, setIsEditorReady] = useState(false)
	const editorRef = useRef<EditorRef | null>(null)
	const monacoRef = useRef<MonacoApi | null>(null)
	const vimModeRef = useRef<any>(null)
	const statusBarRef = useRef<HTMLDivElement | null>(null)
	const loadedThemesRef = useRef<Set<string>>(new Set())
	const onExecuteRef = useRef(onExecute)
	const completionProviderRef = useRef<Monaco.IDisposable | null>(null)

	useEffect(() => {
		onExecuteRef.current = onExecute
	}, [onExecute])

	function getThemeFromDocument(): MonacoTheme {
		if (typeof document !== 'undefined') {
			const classList = document.documentElement.classList

			// Map custom app themes to included Monaco themes
			if (classList.contains('midnight')) return 'dracula'
			if (classList.contains('forest')) return 'nord'
			if (classList.contains('monokai')) return 'monokai'
			if (classList.contains('github-dark')) return 'github-dark'

			// Handle variants
			if (classList.contains('claude-dark')) return 'vs-dark'
			if (classList.contains('claude')) return 'vs' // Light mode

			// Fallback to standard light/dark check
			return classList.contains('light') ? 'vs' : 'vs-dark'
		}
		return 'vs-dark'
	}

	function deriveMonacoTheme(): string {
		if (editorThemeSetting === 'auto') {
			return getThemeFromDocument()
		}
		return editorThemeSetting
	}

	const [editorTheme, setEditorTheme] = useState<string>(deriveMonacoTheme)

	useEffect(
		function syncFromSetting() {
			setEditorTheme(deriveMonacoTheme())
		},
		[editorThemeSetting]
	)

	useEffect(
		function observeTheme() {
			if (editorThemeSetting !== 'auto') return
			const observer = new MutationObserver(function () {
				setEditorTheme(getThemeFromDocument())
			})
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class']
			})
			return function () {
				observer.disconnect()
			}
		},
		[editorThemeSetting]
	)

	useEffect(
		function applyTheme() {
			if (!monacoRef.current) return

			async function apply() {
				const themeName = editorTheme
				if (!isBuiltinTheme(themeName) && !loadedThemesRef.current.has(themeName)) {
					const themeData = await loadTheme(themeName as MonacoTheme)
					if (themeData && monacoRef.current) {
						monacoRef.current.editor.defineTheme(themeName, themeData)
						loadedThemesRef.current.add(themeName)
					}
				}
				if (monacoRef.current) {
					monacoRef.current.editor.setTheme(themeName)
				}
			}
			apply()
		},
		[editorTheme]
	)

	useEffect(
		function handleVimMode() {
			if (!editorRef.current || !statusBarRef.current) return

			if (enableVimMode) {
				if (!vimModeRef.current) {
					vimModeRef.current = initVimMode(editorRef.current, statusBarRef.current)
				}
			} else {
				if (vimModeRef.current) {
					vimModeRef.current.dispose()
					vimModeRef.current = null
				}
			}

			return function () {
				if (vimModeRef.current) {
					vimModeRef.current.dispose()
					vimModeRef.current = null
				}
			}
		},
		[enableVimMode]
	)

	const handleEditorDidMount: OnMount = function (editor, monaco) {
		editorRef.current = editor
		monacoRef.current = monaco
		setIsEditorReady(true)

		monaco.editor.setTheme(editorTheme)

		// Register Execute command (Ctrl/Cmd + Enter)
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
			triggerExecution(editor)
		})

		// Add "Run line" glyph margin listener
		editor.onMouseDown((e) => {
			if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
				const lineNumber = e.target.position?.lineNumber
				if (lineNumber) {
					const model = editor.getModel()
					if (model) {
						const content = model.getLineContent(lineNumber)
						if (content && content.trim() && !content.trim().startsWith('--')) {
							onExecuteRef.current(content)
						}
					}
				}
			}
		})

		updateDecorations(editor, monaco)
	}

	// Update decorations whenever content changes
	useEffect(() => {
		if (editorRef.current && monacoRef.current) {
			updateDecorations(editorRef.current, monacoRef.current)
		}
	}, [value])

	useEffect(
		function syncTheme() {
			if (monacoRef.current) {
				monacoRef.current.editor.setTheme(editorTheme)
			}
		},
		[editorTheme]
	)

	useEffect(
		function registerCompletionProvider() {
			if (!isEditorReady || !monacoRef.current || !editorRef.current) return

			const monaco = monacoRef.current
			completionProviderRef.current?.dispose()

			completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
				triggerCharacters: ['.', ' ', '('],
				provideCompletionItems(model, position) {
					const word = model.getWordUntilPosition(position)
					const range = new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn
					)

					const fullText = model.getValue()
					const beforeCursor = model.getValueInRange({
						startLineNumber: 1,
						startColumn: 1,
						endLineNumber: position.lineNumber,
						endColumn: position.column
					})
					const beforeLower = beforeCursor.toLowerCase()

					const suggestions: Monaco.languages.CompletionItem[] = []
					const aliases = getAliases(beforeLower)
					const fromTables = getFromClauseTables(fullText.toLowerCase())

					// ── dot completion: tableOrAlias.<column> ──────────────────
					const dotMatch = beforeLower.match(/([a-zA-Z_][\w$]*)\.$/)
					if (dotMatch) {
						const receiver = dotMatch[1]
						const tableName = aliases.get(receiver) ?? receiver
						const table = tables.find((t) => t.name.toLowerCase() === tableName)
						if (table?.columns?.length) {
							for (const col of table.columns) {
								suggestions.push({
									label: col.name,
									kind: col.primaryKey
										? monaco.languages.CompletionItemKind.Value
										: monaco.languages.CompletionItemKind.Field,
									insertText: col.name,
									detail: columnDetail(col),
									documentation: col.primaryKey ? 'Primary key' : undefined,
									sortText: `0_${col.name}`,
									command: TRIGGER_SUGGEST,
									range
								})
							}
						}
						return { suggestions }
					}

					// ── next-step contextual keywords ──────────────────────────
					const nextStep = getNextStepKeywords(beforeLower)
					for (const kw of nextStep) {
						suggestions.push({
							label: kw,
							kind: monaco.languages.CompletionItemKind.Keyword,
							insertText: kw === ',' ? ', ' : `${kw} `,
							detail: 'next',
							sortText: `0_${kw}`,
							command: TRIGGER_SUGGEST,
							range
						})
					}

					// ── table name completion ──────────────────────────────────
					const wantsTables = /\b(from|join|update|into|table)\s+[\w]*$/i.test(beforeLower)
					if (wantsTables) {
						for (const table of tables) {
							const colCount = table.columns?.length ?? 0
							suggestions.push({
								label: table.name,
								kind: table.type === 'view'
									? monaco.languages.CompletionItemKind.Interface
									: monaco.languages.CompletionItemKind.Struct,
								insertText: table.name,
								detail: `${table.type} · ${colCount} col${colCount !== 1 ? 's' : ''}`,
								sortText: `0_${table.name}`,
								command: TRIGGER_SUGGEST,
								range
							})
						}
					}

					// ── column completion: prefer FROM-clause tables ───────────
					const wantsColumns =
						/\b(select|where|and|or|not|on|group\s+by|order\s+by|having|set|distinct|returning|case\s+when)\s+[\w]*$/i.test(
							beforeLower
						)

					if (wantsColumns) {
						const inQueryTables = tables.filter((t) =>
							fromTables.has(t.name.toLowerCase())
						)
						const targetTables = inQueryTables.length > 0 ? inQueryTables : tables

						for (const table of targetTables) {
							for (const col of table.columns ?? []) {
								const qualifiedLabel = `${table.name}.${col.name}`
								suggestions.push({
									label: qualifiedLabel,
									kind: col.primaryKey
										? monaco.languages.CompletionItemKind.Value
										: monaco.languages.CompletionItemKind.Field,
									insertText: qualifiedLabel,
									detail: columnDetail(col),
									sortText: `1_${table.name}_${col.name}`,
									command: TRIGGER_SUGGEST,
									range
								})
								if (inQueryTables.length > 0) {
									suggestions.push({
										label: col.name,
										kind: col.primaryKey
											? monaco.languages.CompletionItemKind.Value
											: monaco.languages.CompletionItemKind.Field,
										insertText: col.name,
										detail: `${table.name} · ${columnDetail(col)}`,
										sortText: `0_${col.name}`,
										command: TRIGGER_SUGGEST,
										range
									})
								}
							}
						}
					}

					// ── snippet templates (statement start only) ───────────────
					const atStatementStart = /^\s*[\w]*$/.test(
						beforeLower.slice(beforeLower.lastIndexOf('\n') + 1)
					)
					if (atStatementStart) {
						const snippets: Array<{ label: string; text: string; doc: string }> = [
							{
								label: 'sel',
								text: 'SELECT ${1:*} FROM ${2:table}',
								doc: 'SELECT * FROM table'
							},
							{
								label: 'selw',
								text: 'SELECT ${1:*} FROM ${2:table} WHERE ${3:condition}',
								doc: 'SELECT with WHERE'
							},
							{
								label: 'selj',
								text: 'SELECT ${1:a.*} FROM ${2:table_a} a\nJOIN ${3:table_b} b ON b.${4:id} = a.${5:id}',
								doc: 'SELECT with JOIN'
							},
							{
								label: 'ins',
								text: 'INSERT INTO ${1:table} (${2:col}) VALUES (${3:val})',
								doc: 'INSERT INTO'
							},
							{
								label: 'upd',
								text: 'UPDATE ${1:table} SET ${2:col} = ${3:val} WHERE ${4:condition}',
								doc: 'UPDATE SET WHERE'
							},
							{
								label: 'del',
								text: 'DELETE FROM ${1:table} WHERE ${2:condition}',
								doc: 'DELETE FROM WHERE'
							},
							{
								label: 'exp',
								text: 'EXPLAIN ANALYZE\n${1:SELECT * FROM table}',
								doc: 'EXPLAIN ANALYZE query'
							},
						]
						for (const s of snippets) {
							suggestions.push({
								label: s.label,
								kind: monaco.languages.CompletionItemKind.Snippet,
								insertText: s.text,
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: s.doc,
								sortText: `2_${s.label}`,
								range
							})
						}
					}

					// ── navigating keywords (trigger suggest after insertion) ──
					const NAV_KEYWORDS = new Set([
						'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
						'INNER JOIN', 'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
						'HAVING', 'SET', 'INSERT INTO', 'UPDATE', 'DELETE',
					])

					for (const keyword of SQL_KEYWORDS) {
						suggestions.push({
							label: keyword,
							kind: monaco.languages.CompletionItemKind.Keyword,
							insertText: keyword,
							sortText: `z_${keyword}`,
							command: NAV_KEYWORDS.has(keyword) ? TRIGGER_SUGGEST : undefined,
							range
						})
					}

					return { suggestions }
				}
			})

			return function cleanupCompletionProvider() {
				completionProviderRef.current?.dispose()
				completionProviderRef.current = null
			}
		},
		[tables, isEditorReady]
	)

	function updateDecorations(editor: any, monaco: any) {
		const model = editor.getModel()
		if (!model) return

		const lineCount = model.getLineCount()
		const newDecorations: any[] = []

		for (let i = 1; i <= lineCount; i++) {
			const content = model.getLineContent(i).trim()
			// Show run button for non-empty executable lines
			if (content.length > 0 && !content.startsWith('--')) {
				newDecorations.push({
					range: new monaco.Range(i, 1, i, 1),
					options: {
						isWholeLine: false,
						glyphMarginClassName: 'run-glyph-margin',
						glyphMarginHoverMessage: { value: 'Run Line' }
					}
				})
			}
		}

		const previousDecorations = (editor as any)._previousDecorations || []
		;(editor as any)._previousDecorations = editor.deltaDecorations(
			previousDecorations,
			newDecorations
		)
	}

	function triggerExecution(editor: any) {
		const selection = editor.getSelection()
		const model = editor.getModel()

		if (!selection || !model) return

		let codeToRun = ''

		if (!selection.isEmpty()) {
			codeToRun = model.getValueInRange(selection)
		} else {
			// If no selection, run the whole query or current block (simplified to current line or all for now)
			// Ideally: Run all
			codeToRun = model.getValue()
		}

		if (codeToRun.trim()) {
			onExecuteRef.current(codeToRun)
		}
	}

	const { isActive: isDemoActive, toggleDemoMode } = usePromotionalDemo(editorRef.current)

	return (
		<div className='h-full w-full overflow-hidden pt-2 relative group'>
			{/* Inject global styles for the glyph margin icon */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
                .run-glyph-margin {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981' stroke='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='5 3 19 12 5 21 5 3'/%3E%3C/svg%3E");
                    background-size: 12px 12px;
                    background-repeat: no-repeat;
                    background-position: center;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                .run-glyph-margin:hover {
                    opacity: 1;
                }
             `
				}}
			/>

			<div className='absolute top-2 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity'>
				<button
					onClick={toggleDemoMode}
					className={`text-[10px] px-2 py-0.5 rounded border ${isDemoActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/50 border-border text-muted-foreground'}`}
				>
					{isDemoActive ? 'DEMO ON' : 'DEMO'}
				</button>
			</div>

			<Editor
				height={enableVimMode ? 'calc(100% - 24px)' : '100%'}
				defaultLanguage='sql'
				value={value}
				onChange={function (newValue) {
					onChange(newValue || '')
				}}
				onMount={handleEditorDidMount}
				theme={editorTheme}
				options={{
					minimap: { enabled: false },
					fontSize: editorFontSize,
					lineNumbers: 'on',
					glyphMargin: true,
					scrollBeyondLastLine: false,
					automaticLayout: true,
					tabSize: 2,
					wordBasedSuggestions: 'off',
					readOnly: isExecuting, // We might want to allow typing in demo mode? actually hook handles typing
					padding: { top: 10, bottom: 10 },
					renderLineHighlight: 'all',
					fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
				}}
			/>
			{enableVimMode && (
				<div
					ref={statusBarRef}
					className='h-6 px-2 flex items-center text-xs font-mono bg-sidebar-accent text-sidebar-foreground border-t border-sidebar-border'
				/>
			)}
		</div>
	)
}
