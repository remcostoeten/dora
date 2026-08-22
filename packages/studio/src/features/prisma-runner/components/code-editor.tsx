import type * as Monaco from 'monaco-editor'
import { useState, useEffect, useRef, type MutableRefObject } from 'react'
import { PersistentEditor, type EditorMount } from '@studio/core/editor-host'
import { useSetting } from '@studio/core/settings'
import { loadTheme, isBuiltinTheme, MonacoTheme } from '@studio/core/settings/editor-themes'
import { remeasureMonacoFonts } from '@studio/shared/lib/font-loader'
import { toast } from '@studio/shared/ui/notifier'
import type { DatabaseSchema, TableInfo } from '@studio/lib/bindings'
import { tableToModelKey, type ModelMap } from '../utils/model-mapper'
import { detectPrismaContext } from '../utils/lsp-patterns'

type Props = {
	tabId: string
	value: string
	onChange: (value: string) => void
	onExecute: (code?: string) => void
	onSave?: () => void
	onModeChange?: (mode: 'sql' | 'prisma') => void
	isExecuting: boolean
	schema: DatabaseSchema
	modelMap: ModelMap
}

type EditorRef = Parameters<EditorMount>[0]
type MonacoApi = Parameters<EditorMount>[1]
type Suggestion = Monaco.languages.CompletionItem
type SuggestList = Monaco.languages.CompletionList
type TextRange = Monaco.IRange

const PRISMA_TYPES_URI = 'file:///dora-prisma-schema.d.ts'
const IGNORED_PRISMA_DIAGNOSTICS = [
	2307, // Cannot find module
	2688, // Cannot find type definition file
	2792, // Cannot find module with current moduleResolution
	6053, // File not found
	7016 // Missing declaration file for module
]

const PRISMA_METHODS = [
	'findMany',
	'findFirst',
	'findUnique',
	'create',
	'createMany',
	'update',
	'updateMany',
	'delete',
	'deleteMany',
	'count'
]

const PRISMA_OPERATORS = [
	'equals',
	'not',
	'in',
	'notIn',
	'lt',
	'lte',
	'gt',
	'gte',
	'contains',
	'startsWith',
	'endsWith'
]

const PRISMA_RESERVED = new Set([
	'prisma',
	...PRISMA_METHODS,
	...PRISMA_OPERATORS,
	'where',
	'select',
	'include',
	'orderBy',
	'data',
	'take',
	'skip',
	'cursor',
	'distinct',
	'asc',
	'desc',
	'AND',
	'OR',
	'NOT',
	'true',
	'false',
	'null',
	'const',
	'let',
	'var',
	'await',
	'async',
	'new',
	'Date',
	'queryRaw',
	'executeRaw'
])

function getTable(schema: DatabaseSchema, modelKey: string): TableInfo | undefined {
	return schema.tables.find(function (table) {
		return tableToModelKey(table.name) === modelKey
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

function buildSuggestions(suggestions: Suggestion[]): SuggestList {
	return { suggestions: suggestions, incomplete: false }
}

function simpleItems(
	range: TextRange,
	labels: string[],
	kind: Monaco.languages.CompletionItemKind
): Suggestion[] {
	return labels.map(function (label, index) {
		return {
			label,
			kind,
			insertText: label,
			range,
			sortText: String(index).padStart(3, '0')
		}
	})
}

function relationFields(table: TableInfo): string[] {
	return table.columns
		.filter(function (column) {
			return Boolean(column.foreign_key)
		})
		.map(function (column) {
			if (column.foreign_key) {
				return tableToModelKey(column.foreign_key.referenced_table)
			}
			return tableToModelKey(column.name.replace(/_?id$/i, ''))
		})
}

function isPrismaModel(model: Monaco.editor.ITextModel): boolean {
	return model.uri.toString().includes('/typescript/prisma%3A')
}

function replacePrismaTypes(
	monaco: MonacoApi,
	prismaTypesRef: MutableRefObject<Monaco.IDisposable | null>,
	schema: DatabaseSchema,
	modelMap: ModelMap
): void {
	if (prismaTypesRef.current) {
		prismaTypesRef.current.dispose()
		prismaTypesRef.current = null
	}

	import('../utils/lsp-types')
		.then(function ({ generatePrismaTypes }) {
			if (!monaco) return
			prismaTypesRef.current = monaco.languages.typescript.typescriptDefaults.addExtraLib(
				generatePrismaTypes(schema, modelMap),
				PRISMA_TYPES_URI
			)
		})
		.catch(function (error) {
			console.error('Failed to load Prisma types:', error)
		})
}

export function CodeEditor({
	tabId,
	value,
	onChange,
	onExecute,
	onSave,
	onModeChange,
	isExecuting,
	schema,
	modelMap
}: Props) {
	const [editorFontSize] = useSetting('editorFontSize')
	const [editorThemeSetting] = useSetting('editorTheme')
	const [enableVimMode] = useSetting('enableVimMode')
	const [isEditorReady, setIsEditorReady] = useState(false)
	const editorRef = useRef<EditorRef | null>(null)
	const monacoRef = useRef<MonacoApi | null>(null)
	const vimModeRef = useRef<{ dispose: () => void } | null>(null)
	const statusBarRef = useRef<HTMLDivElement | null>(null)
	const loadedThemesRef = useRef<Set<string>>(new Set())
	const decorRef = useRef<string[]>([])
	const completionProviderRef = useRef<Monaco.IDisposable | null>(null)
	const prismaTypesRef = useRef<Monaco.IDisposable | null>(null)
	const schemaRef = useRef<DatabaseSchema>(schema)
	const modelMapRef = useRef<ModelMap>(modelMap)
	const onExecuteRef = useRef(onExecute)
	const onSaveRef = useRef(onSave)
	const onModeChangeRef = useRef(onModeChange)

	useEffect(
		function syncSchema() {
			schemaRef.current = schema
		},
		[schema]
	)

	useEffect(
		function syncModelMap() {
			modelMapRef.current = modelMap
		},
		[modelMap]
	)

	useEffect(
		function syncOnExecute() {
			onExecuteRef.current = onExecute
		},
		[onExecute]
	)

	useEffect(
		function syncOnSave() {
			onSaveRef.current = onSave
		},
		[onSave]
	)

	useEffect(
		function syncOnModeChange() {
			onModeChangeRef.current = onModeChange
		},
		[onModeChange]
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
					import('monaco-vim')
						.then(function ({ initVimMode }) {
							if (!editorRef.current || !statusBarRef.current || !enableVimMode) {
								return
							}
							if (!vimModeRef.current) {
								vimModeRef.current = initVimMode(
									editorRef.current,
									statusBarRef.current
								)
							}
						})
						.catch(function (error) {
							console.error('Failed to load Vim mode:', error)
							toast.error('Failed to load Vim mode', {
								description: error instanceof Error ? error.message : String(error)
							})
						})
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
		[enableVimMode, isEditorReady]
	)

	useEffect(() => {
		return () => {
			if (completionProviderRef.current) {
				completionProviderRef.current.dispose()
				completionProviderRef.current = null
			}
			if (prismaTypesRef.current) {
				prismaTypesRef.current.dispose()
				prismaTypesRef.current = null
			}
		}
	}, [])

	useEffect(
		function syncPrismaTypes() {
			if (!monacoRef.current) return

			replacePrismaTypes(monacoRef.current, prismaTypesRef, schema, modelMap)
		},
		[schema, modelMap]
	)

	useEffect(
		function detectTypos() {
			if (!monacoRef.current || !editorRef.current) return

			const monaco = monacoRef.current
			const editor = editorRef.current
			const model = editor.getModel()
			if (!model) return

			if (schema.tables.length === 0) {
				monaco.editor.setModelMarkers(model, 'prisma-typos', [])
				return
			}

			const timeoutId = window.setTimeout(function () {
				const editorInTimeout = editorRef.current
				const monacoInTimeout = monacoRef.current
				if (!editorInTimeout || !monacoInTimeout) return

				const modelInTimeout = editorInTimeout.getModel()
				if (!modelInTimeout) return

				import('../../drizzle-runner/utils/fuzzy-match')
					.then(function ({ findClosestMatch }) {
						const modelKeys = Object.keys(modelMapRef.current)
						const fieldNames = new Set<string>()
						for (const table of schemaRef.current.tables) {
							for (const column of table.columns) {
								fieldNames.add(column.name)
							}
						}
						const knownFields = Array.from(fieldNames)

						const markers: Monaco.editor.IMarkerData[] = []
						const lines = value.split('\n')
						const modelKeyRegex = /\bprisma\.([a-zA-Z_$][\w$]*)/g

						for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
							const line = lines[lineIndex]
							let match: RegExpExecArray | null
							modelKeyRegex.lastIndex = 0
							while ((match = modelKeyRegex.exec(line)) !== null) {
								const word = match[1]
								if (modelKeys.includes(word) || PRISMA_RESERVED.has(word)) continue
								const closest = findClosestMatch(word, modelKeys, 2)
								const column = match.index + match[0].indexOf(word) + 1
								markers.push({
									severity: monacoInTimeout.MarkerSeverity.Warning,
									message: closest
										? `Unknown model "${word}". Did you mean "${closest.value}"?`
										: `Unknown model: ${word}`,
									startLineNumber: lineIndex + 1,
									startColumn: column,
									endLineNumber: lineIndex + 1,
									endColumn: column + word.length,
									source: 'Prisma LSP'
								})
							}

							const keyRegex = /([a-zA-Z_$][\w$]*)\s*:/g
							let keyMatch: RegExpExecArray | null
							while ((keyMatch = keyRegex.exec(line)) !== null) {
								const word = keyMatch[1]
								if (
									PRISMA_RESERVED.has(word) ||
									knownFields.includes(word) ||
									modelKeys.includes(word)
								) {
									continue
								}
								const closest =
									findClosestMatch(word, knownFields, 2) ||
									findClosestMatch(word, PRISMA_OPERATORS, 2)
								if (!closest) continue
								const column = keyMatch.index + keyMatch[0].indexOf(word) + 1
								markers.push({
									severity: monacoInTimeout.MarkerSeverity.Warning,
									message: `Unknown field "${word}". Did you mean "${closest.value}"?`,
									startLineNumber: lineIndex + 1,
									startColumn: column,
									endLineNumber: lineIndex + 1,
									endColumn: column + word.length,
									source: 'Prisma LSP'
								})
							}
						}

						monacoInTimeout.editor.setModelMarkers(
							modelInTimeout,
							'prisma-typos',
							markers
						)
					})
					.catch(function (error) {
						console.error('Failed to load Prisma typo detection:', error)
					})
			}, 300)

			return function () {
				window.clearTimeout(timeoutId)
			}
		},
		[value, schema]
	)

	useEffect(() => {
		return () => {
			const editor = editorRef.current
			const monaco = monacoRef.current
			if (!editor || !monaco) return

			const model = editor.getModel()
			if (!model) return

			monaco.editor.setModelMarkers(model, 'prisma-typos', [])
		}
	}, [])

	const handleEditorDidMount: EditorMount = function (editor, monaco) {
		editorRef.current = editor
		monacoRef.current = monaco
		setIsEditorReady(true)

		remeasureMonacoFonts(monaco)
		monaco.editor.setTheme(editorTheme)

		monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
		monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
			target: monaco.languages.typescript.ScriptTarget.ES2020,
			allowNonTsExtensions: true,
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
			moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
			module: monaco.languages.typescript.ModuleKind.ESNext,
			noEmit: true,
			strict: true,
			noImplicitAny: false,
			noUnusedLocals: false,
			noUnusedParameters: false,
			skipLibCheck: true,
			typeRoots: []
		})

		monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: false,
			noSyntaxValidation: false,
			noSuggestionDiagnostics: true,
			diagnosticCodesToIgnore: IGNORED_PRISMA_DIAGNOSTICS
		})

		replacePrismaTypes(monaco, prismaTypesRef, schemaRef.current, modelMapRef.current)

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
				triggerCharacters: ['.', '(', ' ', ':', '{'],
				provideCompletionItems: function (model, position): SuggestList | undefined {
					if (!isPrismaModel(model)) return undefined

					const currentSchema = schemaRef.current
					const currentModelMap = modelMapRef.current
					const textUntilPosition = model.getValueInRange({
						startLineNumber: position.lineNumber,
						startColumn: 1,
						endLineNumber: position.lineNumber,
						endColumn: position.column
					})
					const range = getRange(monaco, model, position)
					const context = detectPrismaContext(textUntilPosition)

					if (context.type === 'model-key') {
						return buildSuggestions(
							simpleItems(
								range,
								Object.keys(currentModelMap),
								monaco.languages.CompletionItemKind.Class
							)
						)
					}

					if (context.type === 'method') {
						return buildSuggestions(
							PRISMA_METHODS.map(function (method, index) {
								return {
									label: method,
									kind: monaco.languages.CompletionItemKind.Method,
									insertText: `${method}($0)`,
									insertTextRules:
										monaco.languages.CompletionItemInsertTextRule
											.InsertAsSnippet,
									range,
									sortText: String(index).padStart(3, '0')
								}
							})
						)
					}

					if (context.type === 'where-field' || context.type === 'orderby-field') {
						const table = getTable(currentSchema, context.modelKey)
						if (!table) return undefined
						return buildSuggestions(
							simpleItems(
								range,
								table.columns.map(function (column) {
									return column.name
								}),
								monaco.languages.CompletionItemKind.Field
							)
						)
					}

					if (context.type === 'include-field') {
						const table = getTable(currentSchema, context.modelKey)
						if (!table) return undefined
						return buildSuggestions(
							simpleItems(
								range,
								relationFields(table),
								monaco.languages.CompletionItemKind.Reference
							)
						)
					}

					if (context.type === 'field-operator') {
						return buildSuggestions(
							simpleItems(
								range,
								PRISMA_OPERATORS,
								monaco.languages.CompletionItemKind.Keyword
							)
						)
					}

					if (context.type === 'orderby-direction') {
						return buildSuggestions(
							simpleItems(
								range,
								['asc', 'desc'],
								monaco.languages.CompletionItemKind.EnumMember
							)
						)
					}

					if (context.type === 'raw-method') {
						return buildSuggestions(
							simpleItems(
								range,
								['queryRaw', 'executeRaw'],
								monaco.languages.CompletionItemKind.Method
							)
						)
					}

					return undefined
				}
			}
		)

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
			triggerExecution(editor)
		})

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
			onSaveRef.current?.()
		})

		editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyS, function () {
			onModeChangeRef.current?.('sql')
		})

		editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyP, function () {
			onModeChangeRef.current?.('prisma')
		})

		editor.onMouseDown(function (e) {
			if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
				const lineNumber = e.target.position?.lineNumber
				if (lineNumber) {
					const currentModel = editor.getModel()
					if (currentModel) {
						const content = currentModel.getLineContent(lineNumber)
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

			<PersistentEditor
				family='typescript'
				tabId={tabId}
				height={enableVimMode ? 'calc(100% - 24px)' : '100%'}
				language='typescript'
				value={value}
				onChange={onChange}
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
