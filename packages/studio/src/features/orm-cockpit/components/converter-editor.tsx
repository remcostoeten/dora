/**
 * Thin Monaco pane for the converter surface — no LSP, no completions, just the
 * studio's editor theme/font settings applied to a plain buffer. The runners'
 * editors carry their whole language tooling with them, so the converter uses
 * its own minimal instance instead.
 */

import Editor from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { useSetting } from '@studio/core/settings'
import { isBuiltinTheme, loadTheme, type MonacoTheme } from '@studio/core/settings/editor-themes'
import { remeasureMonacoFonts } from '@studio/shared/lib/font-loader'
import { Skeleton } from '@studio/shared/ui/skeleton'

type Props = {
	value: string
	language: string
	readOnly?: boolean
	placeholder?: string
	onChange?: (value: string) => void
}

function themeFromDocument(): MonacoTheme {
	if (typeof document === 'undefined') {
		return 'vs-dark'
	}
	const classList = document.documentElement.classList
	if (classList.contains('midnight') || classList.contains('bloom')) return 'dracula'
	if (classList.contains('forest')) return 'nord'
	if (classList.contains('monokai')) return 'monokai'
	if (classList.contains('github-dark')) return 'github-dark'
	if (classList.contains('claude-dark')) return 'vs-dark'
	if (classList.contains('claude')) return 'vs'
	return classList.contains('light') ? 'vs' : 'vs-dark'
}

export function ConverterEditor({ value, language, readOnly, placeholder, onChange }: Props) {
	const [fontSize] = useSetting('editorFontSize')
	const [themeSetting] = useSetting('editorTheme')
	const [ready, setReady] = useState(false)
	const [theme, setTheme] = useState<string>(() =>
		themeSetting === 'auto' ? themeFromDocument() : themeSetting
	)
	const loadedThemes = useRef<Set<string>>(new Set())

	useEffect(() => {
		let cancelled = false
		import('@studio/monaco-workers')
			.then(() => {
				if (!cancelled) setReady(true)
			})
			.catch((error) => {
				console.error('Failed to load Monaco workers:', error)
			})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		setTheme(themeSetting === 'auto' ? themeFromDocument() : themeSetting)
	}, [themeSetting])

	useEffect(() => {
		if (themeSetting !== 'auto') {
			return
		}
		const observer = new MutationObserver(() => {
			setTheme(themeFromDocument())
		})
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		})
		return () => {
			observer.disconnect()
		}
	}, [themeSetting])

	if (!ready) {
		return (
			<div className='h-full bg-editor p-3'>
				<Skeleton className='h-full w-full' />
			</div>
		)
	}

	return (
		<Editor
			height='100%'
			language={language}
			path={readOnly ? 'dora-converter-output' : 'dora-converter-input'}
			value={value}
			onChange={(next) => {
				onChange?.(next ?? '')
			}}
			onMount={async (_editor, monaco) => {
				remeasureMonacoFonts(monaco)
				if (!isBuiltinTheme(theme) && !loadedThemes.current.has(theme)) {
					const data = await loadTheme(theme as MonacoTheme)
					if (data) {
						monaco.editor.defineTheme(theme, data)
						loadedThemes.current.add(theme)
					}
				}
				monaco.editor.setTheme(theme)
			}}
			theme={theme}
			options={{
				minimap: { enabled: false },
				fontSize,
				lineNumbers: 'on',
				scrollBeyondLastLine: false,
				automaticLayout: true,
				tabSize: 2,
				wordBasedSuggestions: 'off',
				quickSuggestions: false,
				readOnly: readOnly === true,
				domReadOnly: readOnly === true,
				padding: { top: 10, bottom: 10 },
				renderLineHighlight: readOnly ? 'none' : 'all',
				placeholder,
				fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
			}}
		/>
	)
}
