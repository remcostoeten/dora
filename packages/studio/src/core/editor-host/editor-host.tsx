import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type * as Monaco from 'monaco-editor'
import type { Monaco as MonacoApi } from '@monaco-editor/react'
import { dropCostlyEditorFocusRule } from './focus-rule'

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
		monacoPromise = import('@studio/monaco-workers')
			.then(({ preloadMonacoWorkers }) => {
				preloadMonacoWorkers()
				return import('monaco-editor') as unknown as Promise<MonacoApi>
			})
			.then((monaco) => {
				dropCostlyEditorFocusRule()
				return monaco
			})
			.catch((error) => {
				monacoPromise = null
				throw error
			})
	}
	return monacoPromise
}

export function getEditorModels(family: EditorFamily) {
	return modelsByFamily[family]
}

/**
 * @name getSelectedEditorText
 * @description Returns the text selected in the hosted editor when it is showing the given tab, or an empty string.
 * @example getSelectedEditorText('sql', 'sql:tab-1')
 */
export function getSelectedEditorText(family: EditorFamily, tabId: string): string {
	const editor = editors.get(family)?.editor
	const model = modelsByFamily[family].get(tabId)
	const selection = editor?.getSelection()
	if (!editor || !model || !selection || editor.getModel() !== model || selection.isEmpty()) {
		return ''
	}
	return model.getValueInRange(selection)
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
	const editor = monaco.editor.create(container, { ...options, automaticLayout: false })
	const hostedEditor = { container, editor, ownerId: null }
	layoutWhileVisible(editor, container)
	editors.set(family, hostedEditor)
	return hostedEditor
}

/**
 * @name layoutWhileVisible
 * @description Replaces Monaco's `automaticLayout` for an editor whose view can be
 * hidden with `display: none`. It relayouts only when the container has a real,
 * changed size, so hiding and showing the view costs no Monaco layout.
 *
 * @example
 * const editor = monaco.editor.create(container, { automaticLayout: false })
 * const stop = layoutWhileVisible(editor, container)
 */
export function layoutWhileVisible(
	editor: Monaco.editor.IStandaloneCodeEditor,
	container: HTMLElement
): () => void {
	const observer = new ResizeObserver((entries) => {
		const box = entries[entries.length - 1]?.contentRect
		if (!box || box.width === 0 || box.height === 0) return
		const current = editor.getLayoutInfo()
		if (Math.abs(box.width - current.width) < 1 && Math.abs(box.height - current.height) < 1)
			return
		editor.layout({ width: box.width, height: box.height })
	})
	observer.observe(container)
	return function () {
		observer.disconnect()
	}
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
	const committedOnChangeRef = useRef(onChange)
	const syncingValueRef = useRef(false)
	const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
	const pendingChangeRef = useRef<number | null>(null)

	onChangeRef.current = onChange

	useLayoutEffect(() => {
		committedOnChangeRef.current = onChange
	})

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
				theme
			})

			hostedEditor.ownerId = ownerId
			mountRef.current.appendChild(hostedEditor.container)
			hostedEditor.editor.updateOptions({ ...options, automaticLayout: false })
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
			if (pendingChangeRef.current !== null) {
				window.clearTimeout(pendingChangeRef.current)
				pendingChangeRef.current = null
				const model = modelRef.current
				if (model && !model.isDisposed()) committedOnChangeRef.current(model.getValue())
			}
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
		hostedEditor.editor.updateOptions({ ...options, automaticLayout: false })
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
