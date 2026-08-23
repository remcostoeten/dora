import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type * as Monaco from 'monaco-editor'
import type { Monaco as MonacoApi } from '@monaco-editor/react'
import { preloadMonacoWorkers } from '@studio/monaco-workers'

export type EditorFamily = 'sql' | 'typescript'
export type EditorMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: MonacoApi) => void

type HostedEditor = {
	container: HTMLDivElement
	editor: Monaco.editor.IStandaloneCodeEditor
	ownerId: symbol | null
}

type Props = {
	family: EditorFamily
	tabId: string
	language: string
	value: string
	onChange: (value: string) => void
	onMount?: EditorMount
	theme?: string
	height?: string | number
	options?: Monaco.editor.IStandaloneEditorConstructionOptions
}

const modelsByFamily: Record<EditorFamily, Map<string, Monaco.editor.ITextModel>> = {
	sql: new Map(),
	typescript: new Map()
}
const editors = new Map<EditorFamily, HostedEditor>()
let monacoPromise: Promise<MonacoApi> | null = null

export function preloadEditorHost(): Promise<MonacoApi> {
	if (!monacoPromise) {
		monacoPromise = Promise.resolve(preloadMonacoWorkers()).then(() => {
			return import('monaco-editor') as unknown as Promise<MonacoApi>
		})
	}
	return monacoPromise
}

export function getEditorModels(family: EditorFamily) {
	return modelsByFamily[family]
}

function getModelUri(monaco: MonacoApi, family: EditorFamily, tabId: string) {
	const extension = family === 'sql' ? 'sql' : 'ts'
	return monaco.Uri.parse(`inmemory://dora/${family}/${encodeURIComponent(tabId)}.${extension}`)
}

function getOrCreateModel(
	monaco: MonacoApi,
	family: EditorFamily,
	tabId: string,
	language: string,
	value: string
): Monaco.editor.ITextModel {
	const models = modelsByFamily[family]
	const existing = models.get(tabId)
	if (existing && !existing.isDisposed()) return existing

	const uri = getModelUri(monaco, family, tabId)
	const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(value, language, uri)
	models.set(tabId, model)
	return model
}

function getOrCreateEditor(
	monaco: MonacoApi,
	family: EditorFamily,
	options: Monaco.editor.IStandaloneEditorConstructionOptions
): HostedEditor {
	const existing = editors.get(family)
	if (existing) return existing

	const container = document.createElement('div')
	container.className = 'h-full w-full'
	const editor = monaco.editor.create(container, options)
	const hostedEditor = { container, editor, ownerId: null }
	editors.set(family, hostedEditor)
	return hostedEditor
}

export function PersistentEditor({
	family,
	tabId,
	language,
	value,
	onChange,
	onMount,
	theme,
	height = '100%',
	options = {}
}: Props) {
	const mountRef = useRef<HTMLDivElement | null>(null)
	const ownerIdRef = useRef(Symbol(`${family}:${tabId}`))
	const onChangeRef = useRef(onChange)
	const syncingValueRef = useRef(false)
	const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
	const pendingChangeRef = useRef<number | null>(null)

	onChangeRef.current = onChange

	useLayoutEffect(() => {
		let disposed = false
		let contentListener: Monaco.IDisposable | null = null
		const ownerId = ownerIdRef.current

		void preloadEditorHost().then((monaco) => {
			if (disposed || !mountRef.current) return
			const model = getOrCreateModel(monaco, family, tabId, language, value)
			const hostedEditor = getOrCreateEditor(monaco, family, {
				...options,
				model,
				theme,
				automaticLayout: true
			})

			hostedEditor.ownerId = ownerId
			mountRef.current.appendChild(hostedEditor.container)
			hostedEditor.editor.updateOptions(options)
			hostedEditor.editor.setModel(model)
			modelRef.current = model
			if (theme) monaco.editor.setTheme(theme)
			hostedEditor.editor.layout()
			onMount?.(hostedEditor.editor, monaco)

			contentListener = model.onDidChangeContent(() => {
				if (syncingValueRef.current) return
				if (pendingChangeRef.current !== null) {
					window.clearTimeout(pendingChangeRef.current)
				}
				pendingChangeRef.current = window.setTimeout(() => {
					pendingChangeRef.current = null
					onChangeRef.current(model.getValue())
				}, 400)
			})
		})

		return () => {
			disposed = true
			contentListener?.dispose()
			const hostedEditor = editors.get(family)
			if (hostedEditor?.ownerId === ownerId) hostedEditor.ownerId = null
		}
	}, [family, language, tabId])

	useEffect(() => {
		const model = modelRef.current
		if (!model || model.getValue() === value) return
		syncingValueRef.current = true
		model.setValue(value)
		syncingValueRef.current = false
	}, [value])

	useEffect(() => {
		const hostedEditor = editors.get(family)
		if (!hostedEditor || hostedEditor.ownerId !== ownerIdRef.current) return
		hostedEditor.editor.updateOptions(options)
	}, [family, options])

	useEffect(() => {
		if (!theme) return
		void preloadEditorHost().then((monaco) => {
			monaco.editor.setTheme(theme)
		})
	}, [theme])

	const style: CSSProperties = { height, width: '100%' }
	return <div ref={mountRef} style={style} />
}
