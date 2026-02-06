import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { initVimMode } from 'monaco-vim'
import type { VimAdapterInstance } from 'monaco-vim'
import { useState, useEffect, useRef } from 'react'
import { useSetting } from '@/core/settings'
import { loadTheme, isBuiltinTheme, MonacoTheme } from '@/core/settings/editor-themes'
import { SchemaColumn, SchemaTable } from '../types'
import {
	getDbName,
	getTableMatch,
	getChainMode,
	getColumnMatch,
	getValueMatch,
	getJoinMatch,
	isInsideSelectParens,
	isInsideInsertParens,
	isInsideUpdateParens,
	isInsideDeleteParens,
	isInsideFromParens,
	isInsideJoinParens
} from '../utils/lsp-patterns'
import { generateDrizzleTypes } from '../utils/lsp-utils'
import { detectTyposInQuery, getSuggestions, getTableNames as getFuzzyTableNames } from '../utils/fuzzy-match'
import { LspDemoWidget } from './lsp-demo-widget'

type Props = {
	value: string
	onChange: (value: string) => void
	onExecute: (code?: string) => void
	isExecuting: boolean
	tables: SchemaTable[]
}

type EditorRef = Parameters<OnMount>[0]
type MonacoApi = Parameters<OnMount>[1]
type Suggestion = Monaco.languages.CompletionItem
type SuggestList = Monaco.languages.CompletionList
type TextRange = Monaco.IRange
type TypeKind = 'number' | 'string' | 'boolean' | 'date' | 'unknown'

function getTypeKind(columnType: string): TypeKind {
	if (/int|serial|decimal|double|float|numeric|real/.test(columnType)) {
		return 'number'
	}
	if (/char|text|uuid|json|enum/.test(columnType)) {
		return 'string'
	}
	if (/bool/.test(columnType)) {
		return 'boolean'
	}
	if (/timestamp|date|time/.test(columnType)) {
		return 'date'
	}
	return 'unknown'
}

function getValueSnippet(kind: TypeKind): string {
	if (kind === 'number') return '0'
	if (kind === 'string') return '""'
	if (kind === 'boolean') return 'false'
	if (kind === 'date') return 'new Date()'
	return 'null'
}

function getTable(tables: SchemaTable[], tableName: string): SchemaTable | undefined {
	return tables.find(function (table) {
		return table.name === tableName
	})
}

function getColumn(table: SchemaTable, columnName: string): SchemaColumn | undefined {
	return table.columns.find(function (column) {
		return column.name === columnName
	})
}

function getRange(
	monaco: MonacoApi,
	model: Monaco.editor.ITextModel,
	position: Monaco.Position
): TextRange {
	const word = model.getWordUntilPosition(position)
	return new monaco.Range(
		position.lineNumber,
		word.startColumn,
		position.lineNumber,
		word.endColumn
	)
}

function tableSnippet(table: SchemaTable): string {
	return `${table.name}).$0`
}

function valuesSnippet(table: SchemaTable, includePrimary: boolean): string {
	const columns = table.columns.filter(function (column) {
		if (includePrimary) return true
		return !column.primaryKey
	})
	const items = columns.map(function (column, index) {
		const value = getValueSnippet(getTypeKind(column.type))
		if (index === 0) {
			return `${column.name}: \${1:${value}}`
		}
		return `${column.name}: ${value}`
	})
	return `{ ${items.join(', ')} }`
}

function shouldSuggest(text: string): boolean {
	return /[a-zA-Z0-9_.(),\s]/.test(text)
}

function hasChain(text: string, name: string): boolean {
	return new RegExp(`\\.${name}\\(`).test(text)
}

function getJoinSnippet(leftTable: SchemaTable, rightTable: SchemaTable): string | null {
	const leftId = leftTable.columns.find(function (column) {
		return column.primaryKey || column.name === 'id'
	})
	if (!leftId) return null
	const rightMatch = rightTable.columns.find(function (column) {
		return column.name === `${leftTable.name}Id` || column.name === `${leftTable.name}_id`
	})
	if (!rightMatch) return null
	return `eq(${leftTable.name}.${leftId.name}, ${rightTable.name}.${rightMatch.name})`
}

function buildSuggestions(range: TextRange, suggestions: Suggestion[]): SuggestList {
	return { suggestions: suggestions, incomplete: false }
}

export function CodeEditor({ value, onChange, onExecute, isExecuting, tables }: Props) {
	const [showDemo, setShowDemo] = useState(false)
	const [editorFontSize] = useSetting('editorFontSize')
	const [editorThemeSetting] = useSetting('editorTheme')
	const [enableVimMode] = useSetting('enableVimMode')
	const editorRef = useRef<EditorRef | null>(null)
	const monacoRef = useRef<MonacoApi | null>(null)
	const vimModeRef = useRef<VimAdapterInstance | null>(null)
	const statusBarRef = useRef<HTMLDivElement | null>(null)
	const loadedThemesRef = useRef<Set<string>>(new Set())
	const decorRef = useRef<string[]>([])
	const completionProviderRef = useRef<Monaco.IDisposable | null>(null)
	const onExecuteRef = useRef(onExecute)

	useEffect(
		function syncOnExecute() {
			onExecuteRef.current = onExecute
		},
		[onExecute]
	)

	function getThemeFromDocument(): MonacoTheme {
		if (typeof document !== 'undefined') {
			return document.documentElement.classList.contains('light') ? 'vs' : 'vs-dark'
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

	useEffect(() => {
		return () => {
			if (completionProviderRef.current) {
				completionProviderRef.current.dispose()
				completionProviderRef.current = null
			}
		}
	}, [])

	useEffect(
		function detectTypos() {
			if (!monacoRef.current || !editorRef.current || tables.length === 0) return

			const editor = editorRef.current
			const monaco = monacoRef.current
			const model = editor.getModel()
			if (!model) return

			const typos = detectTyposInQuery(value, tables)

			const markers: Monaco.editor.IMarkerData[] = typos.map(function (typo) {
				const startPos = model.getPositionAt(typo.startIndex)
				const endPos = model.getPositionAt(typo.endIndex)

				return {
					severity: monaco.MarkerSeverity.Warning,
					message: typo.suggestion
						? `Did you mean "${typo.suggestion}"?`
						: `Unknown identifier: ${typo.word}`,
					startLineNumber: startPos.lineNumber,
					startColumn: startPos.column,
					endLineNumber: endPos.lineNumber,
					endColumn: endPos.column,
					source: 'Drizzle LSP'
				}
			})

			monaco.editor.setModelMarkers(model, 'drizzle-typos', markers)

			return function () {
				if (monacoRef.current && model) {
					monacoRef.current.editor.setModelMarkers(model, 'drizzle-typos', [])
				}
			}
		},
		[value, tables]
	)

	const handleEditorDidMount: OnMount = function (editor, monaco) {
		editorRef.current = editor
		monacoRef.current = monaco

		monaco.editor.setTheme(editorTheme)

		monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
			target: monaco.languages.typescript.ScriptTarget.ES2016,
			allowNonTsExtensions: true,
			moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
			module: monaco.languages.typescript.ModuleKind.CommonJS,
			noEmit: true,
			strict: false,
			noImplicitAny: false,
			typeRoots: []
		})

		monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: true,
			noSyntaxValidation: true
		})

		const drizzleTypes = generateDrizzleTypes(tables)
		const libUri = 'file:///drizzle.d.ts'
		monaco.languages.typescript.typescriptDefaults.addExtraLib(drizzleTypes, libUri)

		const model = editor.getModel()
		if (model) {
			monaco.editor.setModelLanguage(model, 'typescript')
		}

		if (completionProviderRef.current) {
			completionProviderRef.current.dispose()
		}

		completionProviderRef.current = monaco.languages.registerCompletionItemProvider(
			'typescript',
			{
				triggerCharacters: ['.', '(', ',', ' '],
				exclusive: true,
				provideCompletionItems: function (model, position): SuggestList {
					const textUntilPosition = model.getValueInRange({
						startLineNumber: position.lineNumber,
						startColumn: 1,
						endLineNumber: position.lineNumber,
						endColumn: position.column
					})
					const range = getRange(monaco, model, position)

					const dbName = getDbName(textUntilPosition)
					if (dbName) {
						const suggestions: Suggestion[] = [
							{
								label: 'select',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'select($1)$0',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Start a SELECT query → chain .from()',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'insert',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'insert(${1:table})$0',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Start an INSERT query',
								range: range,
								sortText: '1',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'update',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'update(${1:table})$0',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Start an UPDATE query',
								range: range,
								sortText: '2',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'delete',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'delete(${1:table})$0',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Start a DELETE query',
								range: range,
								sortText: '3',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'batch',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'batch([$0])',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Run a batch of queries',
								range: range,
								sortText: '4'
							}
						]
						if (dbName === 'db') {
							suggestions.splice(4, 0, {
								label: 'transaction',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'transaction(async tx => {\n  $0\n})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Run queries in a transaction',
								range: range,
								sortText: '4'
							})
						}
						return buildSuggestions(range, suggestions)
					}

					if (isInsideSelectParens(textUntilPosition)) {
						return buildSuggestions(
							range,
							tables.map(function (table, index) {
								return {
									label: table.name,
									kind: monaco.languages.CompletionItemKind.Variable,
									insertText: tableSnippet(table),
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Table',
									range: range,
									sortText: String(index).padStart(3, '0'),
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								}
							})
						)
					}

					if (
						isInsideInsertParens(textUntilPosition) ||
						isInsideUpdateParens(textUntilPosition) ||
						isInsideDeleteParens(textUntilPosition)
					) {
						return buildSuggestions(
							range,
							tables.map(function (table, index) {
								return {
									label: table.name,
									kind: monaco.languages.CompletionItemKind.Variable,
									insertText: tableSnippet(table),
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Table',
									range: range,
									sortText: String(index).padStart(3, '0'),
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								}
							})
						)
					}

					if (isInsideFromParens(textUntilPosition)) {
						return buildSuggestions(
							range,
							tables.map(function (table, index) {
								return {
									label: table.name,
									kind: monaco.languages.CompletionItemKind.Variable,
									insertText: tableSnippet(table),
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Table',
									range: range,
									sortText: String(index).padStart(3, '0'),
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								}
							})
						)
					}

					if (isInsideJoinParens(textUntilPosition)) {
						return buildSuggestions(
							range,
							tables.map(function (table, index) {
								return {
									label: table.name,
									kind: monaco.languages.CompletionItemKind.Variable,
									insertText: `${table.name}, $0)`,
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Join table',
									range: range,
									sortText: String(index).padStart(3, '0'),
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								}
							})
						)
					}

					if (/\.values\(\s*$/.test(textUntilPosition)) {
						const tableMatch = textUntilPosition.match(
							/\b(?:db|tx)\.insert\(\s*([a-zA-Z_][\w]*)\s*\)/
						)
						if (tableMatch) {
							const table = getTable(tables, tableMatch[1])
							if (table) {
								return buildSuggestions(range, [
									{
										label: 'values',
										kind: monaco.languages.CompletionItemKind.Struct,
										insertText: `${valuesSnippet(table, true)})$0`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Insert values',
										range: range
									}
								])
							}
						}
					}

					if (/\.set\(\s*$/.test(textUntilPosition)) {
						const tableMatch = textUntilPosition.match(
							/\b(?:db|tx)\.update\(\s*([a-zA-Z_][\w]*)\s*\)/
						)
						if (tableMatch) {
							const table = getTable(tables, tableMatch[1])
							if (table) {
								return buildSuggestions(range, [
									{
										label: 'set',
										kind: monaco.languages.CompletionItemKind.Struct,
										insertText: `${valuesSnippet(table, false)})$0`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Update values',
										range: range
									}
								])
							}
						}
					}

					if (/\.where\(\s*$/.test(textUntilPosition)) {
						const fromMatch = textUntilPosition.match(
							/\.from\(\s*([a-zA-Z_][\w]*)\s*\)/
						)
						const baseSuggestions = [
							{
								label: 'eq',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'eq(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Equal',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'ne',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'ne(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Not equal',
								range: range,
								sortText: '1',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'gt',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'gt(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Greater than',
								range: range,
								sortText: '2',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'gte',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'gte(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Greater or equal',
								range: range,
								sortText: '3',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'lt',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'lt(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Less than',
								range: range,
								sortText: '4',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'lte',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'lte(${1:column}, ${2:value})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Less or equal',
								range: range,
								sortText: '5',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'inArray',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'inArray(${1:column}, ${2:values})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'In array',
								range: range,
								sortText: '6',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'isNull',
								kind: monaco.languages.CompletionItemKind.Function,
								insertText: 'isNull(${1:column})',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Is null',
								range: range,
								sortText: '7',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							}
						]

						if (fromMatch) {
							const table = getTable(tables, fromMatch[1])
							if (table) {
								const tableSuggestions = table.columns.map(
									function (column, index) {
										return {
											label: `${table.name}.${column.name}`,
											kind: monaco.languages.CompletionItemKind.Field,
											insertText: `eq(${table.name}.${column.name}, $0)`,
											insertTextRules:
												monaco.languages.CompletionItemInsertTextRule
													.InsertAsSnippet,
											detail: 'Condition',
											range: range,
											sortText: `9${String(index).padStart(3, '0')}`
										}
									}
								)
								return buildSuggestions(
									range,
									baseSuggestions.concat(tableSuggestions)
								)
							}
						}
						return buildSuggestions(range, baseSuggestions)
					}

					const joinMatch = getJoinMatch(textUntilPosition)
					if (joinMatch) {
						const leftTable = getTable(tables, joinMatch[1])
						const rightTable = getTable(tables, joinMatch[2])
						if (leftTable && rightTable) {
							const joinSnippet = getJoinSnippet(leftTable, rightTable)
							if (joinSnippet) {
								return buildSuggestions(range, [
									{
										label: joinSnippet,
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `${joinSnippet}$0`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Join condition',
										range: range
									}
								])
							}
						}
					}

					const helperMatch = textUntilPosition.match(
						/\b(eq|ne|gt|gte|lt|lte|inArray)\(\s*$/
					)
					if (helperMatch) {
						const suggestions: Suggestion[] = []
						tables.forEach(function (table) {
							table.columns.forEach(function (column, index) {
								suggestions.push({
									label: `${table.name}.${column.name}`,
									kind: monaco.languages.CompletionItemKind.Field,
									insertText: `${table.name}.${column.name}, \${1})`,
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: column.type,
									range: range,
									sortText: String(index).padStart(3, '0'),
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								})
							})
						})
						return buildSuggestions(range, suggestions)
					}

					const valueMatch = getValueMatch(textUntilPosition)
					if (valueMatch) {
						const table = getTable(tables, valueMatch[2])
						if (table) {
							const column = getColumn(table, valueMatch[3])
							if (column) {
								const kind = getTypeKind(column.type)
								const valueSuggestions: Suggestion[] = []
								if (kind === 'number') {
									valueSuggestions.push(
										{
											label: '1',
											kind: monaco.languages.CompletionItemKind.Value,
											insertText: '1',
											range: range,
											sortText: '0'
										},
										{
											label: '10',
											kind: monaco.languages.CompletionItemKind.Value,
											insertText: '10',
											range: range,
											sortText: '1'
										},
										{
											label: '100',
											kind: monaco.languages.CompletionItemKind.Value,
											insertText: '100',
											range: range,
											sortText: '2'
										}
									)
								}
								if (kind === 'string') {
									valueSuggestions.push({
										label: '"test@example.com"',
										kind: monaco.languages.CompletionItemKind.Value,
										insertText: '"test@example.com"',
										range: range,
										sortText: '0'
									})
								}
								if (kind === 'boolean') {
									valueSuggestions.push(
										{
											label: 'true',
											kind: monaco.languages.CompletionItemKind.Value,
											insertText: 'true',
											range: range,
											sortText: '0'
										},
										{
											label: 'false',
											kind: monaco.languages.CompletionItemKind.Value,
											insertText: 'false',
											range: range,
											sortText: '1'
										}
									)
								}
								if (kind === 'date') {
									valueSuggestions.push({
										label: 'new Date()',
										kind: monaco.languages.CompletionItemKind.Value,
										insertText: 'new Date()',
										range: range,
										sortText: '0'
									})
								}
								valueSuggestions.push({
									label: 'param()',
									kind: monaco.languages.CompletionItemKind.Function,
									insertText: 'param($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Parameter',
									range: range,
									sortText: '9'
								})
								return buildSuggestions(range, valueSuggestions)
							}
						}
					}

					const columnMatch = getColumnMatch(textUntilPosition)
					if (columnMatch) {
						const table = getTable(tables, columnMatch[1])
						if (table) {
							const column = getColumn(table, columnMatch[2])
							if (column) {
								const columnRef = `${table.name}.${column.name}`
								return buildSuggestions(range, [
									{
										label: 'eq',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `eq(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Equal',
										range: range,
										sortText: '0',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'ne',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `ne(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Not equal',
										range: range,
										sortText: '1',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'gt',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `gt(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Greater than',
										range: range,
										sortText: '2',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'gte',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `gte(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Greater or equal',
										range: range,
										sortText: '3',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'lt',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `lt(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Less than',
										range: range,
										sortText: '4',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'lte',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `lte(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Less or equal',
										range: range,
										sortText: '5',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'inArray',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `inArray(${columnRef}, $0)`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'In array',
										range: range,
										sortText: '6',
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									},
									{
										label: 'isNull',
										kind: monaco.languages.CompletionItemKind.Function,
										insertText: `isNull(${columnRef})`,
										insertTextRules:
											monaco.languages.CompletionItemInsertTextRule
												.InsertAsSnippet,
										detail: 'Is null',
										range: range,
										sortText: '7'
									}
								])
							}
						}
					}

					const tableMatch = getTableMatch(textUntilPosition)
					if (tableMatch) {
						const table = getTable(tables, tableMatch[1])
						if (table) {
							return buildSuggestions(
								range,
								table.columns.map(function (column, index) {
									return {
										label: column.name,
										kind: monaco.languages.CompletionItemKind.Field,
										insertText: column.name,
										detail: column.type,
										range: range,
										sortText: String(index).padStart(3, '0'),
										command: {
											id: 'editor.action.triggerSuggest',
											title: 'Trigger Suggest'
										}
									}
								})
							)
						}
					}

					const chainMode = getChainMode(textUntilPosition)
					if (chainMode === 'select') {
						const suggestions: Suggestion[] = []
						const hasFrom = hasChain(textUntilPosition, 'from')
						if (!hasFrom) {
							suggestions.push({
								label: 'from',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'from(${1:table})$0',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Select from a table',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							})
						} else {
							suggestions.push(
								{
									label: 'where',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'where($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Filter results',
									range: range,
									sortText: '1',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'leftJoin',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'leftJoin($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Left join',
									range: range,
									sortText: '2',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'rightJoin',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'rightJoin($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Right join',
									range: range,
									sortText: '3',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'innerJoin',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'innerJoin($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Inner join',
									range: range,
									sortText: '4',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'fullJoin',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'fullJoin($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Full join',
									range: range,
									sortText: '5',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'groupBy',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'groupBy(${1:column})$0',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Group results',
									range: range,
									sortText: '6',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'having',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'having($0)',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Filter groups',
									range: range,
									sortText: '7',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'orderBy',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'orderBy(${1:column})$0',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Order results',
									range: range,
									sortText: '8',
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								},
								{
									label: 'limit',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'limit(${1:100})$0',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Limit rows',
									range: range,
									sortText: '9'
								},
								{
									label: 'offset',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'offset(${1:0})$0',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Skip rows',
									range: range,
									sortText: '10'
								}
							)

							suggestions.push(
								{
									label: 'union',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'union(${1:query})',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Union',
									range: range,
									sortText: '11'
								},
								{
									label: 'unionAll',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'unionAll(${1:query})',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Union All',
									range: range,
									sortText: '12'
								},
								{
									label: 'intersect',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'intersect(${1:query})',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Intersect',
									range: range,
									sortText: '13'
								},
								{
									label: 'except',
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: 'except(${1:query})',
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									detail: 'Except',
									range: range,
									sortText: '14'
								}
							)
						}
						return buildSuggestions(range, suggestions)
					}

					if (chainMode === 'insert') {
						return buildSuggestions(range, [
							{
								label: 'values',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'values($0)',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Insert values',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'returning',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'returning()',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Return rows',
								range: range,
								sortText: '1'
							},
							{
								label: 'onConflictDoUpdate',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText:
									'onConflictDoUpdate({ target: ${1:column}, set: { $0 } })',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Upsert (Update on conflict)',
								range: range,
								sortText: '2'
							},
							{
								label: 'onConflictDoNothing',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'onConflictDoNothing()',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Ignore conflict',
								range: range,
								sortText: '3'
							}
						])
					}

					if (chainMode === 'update') {
						return buildSuggestions(range, [
							{
								label: 'set',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'set($0)',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Set values',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'where',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'where($0)',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Filter rows',
								range: range,
								sortText: '1'
							},
							{
								label: 'returning',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'returning()',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Return rows',
								range: range,
								sortText: '2'
							}
						])
					}

					if (chainMode === 'delete') {
						return buildSuggestions(range, [
							{
								label: 'where',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'where($0)',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Filter rows',
								range: range,
								sortText: '0',
								command: {
									id: 'editor.action.triggerSuggest',
									title: 'Trigger Suggest'
								}
							},
							{
								label: 'returning',
								kind: monaco.languages.CompletionItemKind.Method,
								insertText: 'returning()',
								insertTextRules:
									monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
								detail: 'Return rows',
								range: range,
								sortText: '1'
							}
						])
					}

					// Default: show Drizzle-relevant completions only (no empty = no TypeScript globals)
					const defaultSuggestions: Suggestion[] = [
						{
							label: 'db',
							kind: monaco.languages.CompletionItemKind.Variable,
							insertText: 'db.',
							detail: 'Database instance',
							range: range,
							sortText: '0',
							command: {
								id: 'editor.action.triggerSuggest',
								title: 'Trigger Suggest'
							}
						},
						// Helper functions
						{
							label: 'eq',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'eq(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Equal comparison',
							range: range,
							sortText: '10'
						},
						{
							label: 'ne',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'ne(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Not equal',
							range: range,
							sortText: '11'
						},
						{
							label: 'gt',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'gt(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Greater than',
							range: range,
							sortText: '12'
						},
						{
							label: 'gte',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'gte(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Greater or equal',
							range: range,
							sortText: '13'
						},
						{
							label: 'lt',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'lt(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Less than',
							range: range,
							sortText: '14'
						},
						{
							label: 'lte',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'lte(${1:column}, ${2:value})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Less or equal',
							range: range,
							sortText: '15'
						},
						{
							label: 'and',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'and(${1:condition1}, ${2:condition2})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'AND conditions',
							range: range,
							sortText: '16'
						},
						{
							label: 'or',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'or(${1:condition1}, ${2:condition2})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'OR conditions',
							range: range,
							sortText: '17'
						},
						{
							label: 'asc',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'asc(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Ascending order',
							range: range,
							sortText: '18'
						},
						{
							label: 'desc',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'desc(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Descending order',
							range: range,
							sortText: '19'
						},

						// New operators
						{
							label: 'isNull',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'isNull(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Is NULL',
							range: range,
							sortText: '20'
						},
						{
							label: 'isNotNull',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'isNotNull(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Is NOT NULL',
							range: range,
							sortText: '21'
						},
						{
							label: 'inArray',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'inArray(${1:column}, ${2:[values]})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'In list',
							range: range,
							sortText: '22'
						},
						{
							label: 'notInArray',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'notInArray(${1:column}, ${2:[values]})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Not in list',
							range: range,
							sortText: '23'
						},
						{
							label: 'exists',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'exists($0)',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Exists subquery',
							range: range,
							sortText: '24'
						},
						{
							label: 'notExists',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'notExists($0)',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Not exists subquery',
							range: range,
							sortText: '25'
						},
						{
							label: 'between',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'between(${1:column}, ${2:min}, ${3:max})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Between range',
							range: range,
							sortText: '26'
						},
						{
							label: 'not',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'not($0)',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Negate condition',
							range: range,
							sortText: '27'
						},
						{
							label: 'like',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'like(${1:column}, ${2:pattern})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Like pattern',
							range: range,
							sortText: '28'
						},
						{
							label: 'ilike',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'ilike(${1:column}, ${2:pattern})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Case-insensitive like',
							range: range,
							sortText: '29'
						},

						// Aggregates
						{
							label: 'count',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'count(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Count rows',
							range: range,
							sortText: '30'
						},
						{
							label: 'countDistinct',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'countDistinct(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Count distinct',
							range: range,
							sortText: '31'
						},
						{
							label: 'sum',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'sum(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Sum values',
							range: range,
							sortText: '32'
						},
						{
							label: 'sumDistinct',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'sumDistinct(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Sum distinct',
							range: range,
							sortText: '33'
						},
						{
							label: 'avg',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'avg(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Average value',
							range: range,
							sortText: '34'
						},
						{
							label: 'min',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'min(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Minimum value',
							range: range,
							sortText: '35'
						},
						{
							label: 'max',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'max(${1:column})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Maximum value',
							range: range,
							sortText: '36'
						},

						// Root / Other
						{
							label: 'with',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'with("${1:alias}").as($0)',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Common Table Expression',
							range: range,
							sortText: '37'
						},
						{
							label: 'query',
							kind: monaco.languages.CompletionItemKind.Property,
							insertText: 'query',
							detail: 'Relational Queries',
							range: range,
							sortText: '38'
						},

						// Postgres Array Operators
						{
							label: 'arrayContains',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'arrayContains(${1:column}, ${2:values})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Array contains',
							range: range,
							sortText: '39'
						},
						{
							label: 'arrayContained',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'arrayContained(${1:column}, ${2:values})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Array contained by',
							range: range,
							sortText: '40'
						},
						{
							label: 'arrayOverlaps',
							kind: monaco.languages.CompletionItemKind.Function,
							insertText: 'arrayOverlaps(${1:column}, ${2:values})',
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							detail: 'Array overlaps',
							range: range,
							sortText: '41'
						}
					]

					// Add table names
					tables.forEach(function (table, index) {
						defaultSuggestions.push({
							label: table.name,
							kind: monaco.languages.CompletionItemKind.Variable,
							insertText: table.name,
							detail: 'Table',
							range: range,
							sortText: `5${String(index).padStart(3, '0')}`
						})
					})

					const word = model.getWordUntilPosition(position)
					if (word.word && word.word.length >= 2) {
						const tableNames = getFuzzyTableNames(tables)
						const isExactMatch = tableNames.some(function (name) {
							return name.toLowerCase() === word.word.toLowerCase()
						})

						if (!isExactMatch) {
							const fuzzyMatches = getSuggestions(word.word, tableNames, 3)
							fuzzyMatches.forEach(function (match, index) {
								defaultSuggestions.unshift({
									label: `${match.value} (did you mean?)`,
									kind: monaco.languages.CompletionItemKind.Variable,
									insertText: match.value,
									detail: `Suggestion for "${word.word}"`,
									range: range,
									sortText: `0${String(index).padStart(3, '0')}`,
									filterText: word.word,
									command: {
										id: 'editor.action.triggerSuggest',
										title: 'Trigger Suggest'
									}
								})
							})
						}
					}

					return buildSuggestions(range, defaultSuggestions)
				}
			}
		)

		editor.onDidType(function (text) {
			if (shouldSuggest(text)) {
				editor.trigger('drizzle', 'editor.action.triggerSuggest', {})
			}
		})

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
			triggerExecution(editor)
		})

		editor.onMouseDown(function (e) {
			if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
				const lineNumber = e.target.position?.lineNumber
				if (lineNumber) {
					const model = editor.getModel()
					if (model) {
						const content = model.getLineContent(lineNumber)
						if (content && content.trim()) {
							onExecuteRef.current(content)
						}
					}
				}
			}
		})

		updateDecorations(editor, monaco)
	}

	useEffect(
		function () {
			if (editorRef.current && monacoRef.current) {
				updateDecorations(editorRef.current, monacoRef.current)
			}
		},
		[value]
	)

	useEffect(
		function syncTheme() {
			if (monacoRef.current) {
				monacoRef.current.editor.setTheme(editorTheme)
			}
		},
		[editorTheme]
	)

	function updateDecorations(editor: EditorRef, monaco: MonacoApi): void {
		const model = editor.getModel()
		if (!model) return

		const lineCount = model.getLineCount()
		const newDecorations: Monaco.editor.IModelDeltaDecoration[] = []

		for (let i = 1; i <= lineCount; i++) {
			const content = model.getLineContent(i).trim()
			if (content.length > 0 && !content.startsWith('//') && !content.startsWith('/*')) {
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

		decorRef.current = editor.deltaDecorations(decorRef.current, newDecorations)
	}

	function triggerExecution(editor: EditorRef): void {
		const selection = editor.getSelection()
		const model = editor.getModel()

		if (!selection || !model) return

		let codeToRun = ''

		if (!selection.isEmpty()) {
			codeToRun = model.getValueInRange(selection)
		} else {
			const position = editor.getPosition()
			if (position) {
				codeToRun = model.getLineContent(position.lineNumber)
			}
		}

		if (codeToRun.trim()) {
			onExecuteRef.current(codeToRun)
		}
	}

	return (
		<div className='h-full w-full overflow-hidden pt-2 relative group'>
			{/* Demo Toggle Button */}
			<button
				onClick={() => setShowDemo(!showDemo)}
				className='absolute top-4 right-8 z-10 px-2 py-1 text-xs bg-muted/50 hover:bg-muted text-muted-foreground rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity'
			>
				{showDemo ? 'Hide Demo' : 'LSP Demo'}
			</button>

			{showDemo && <LspDemoWidget editorRef={editorRef} onClose={() => setShowDemo(false)} />}
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

			<Editor
				height={enableVimMode ? 'calc(100% - 24px)' : '100%'}
				defaultLanguage='typescript'
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
					suggestOnTriggerCharacters: true,
					quickSuggestions: false,
					suggest: {
						showKeywords: false,
						showSnippets: false,
						showWords: false,
						showClasses: false,
						showInterfaces: false,
						showFunctions: false,
						showVariables: false,
						showConstants: false,
						showEnums: false,
						showEnumMembers: false,
						showModules: false,
						showOperators: false,
						showReferences: false,
						showStructs: false,
						showTypeParameters: false,
						filterGraceful: false
					},
					readOnly: isExecuting,
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
