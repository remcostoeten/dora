'use client'

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion } from '@codemirror/autocomplete'
import { useTheme } from '@/core/state'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { EditorToolbar } from '@/components/editor-toolbar'
import { prettifySQL, minifySQL, prettifyJSON } from '@/core/formatters'
import { Wand2, Minimize2, Copy, Clipboard, Scissors, Database, FileJson } from 'lucide-react'

type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  schema?: {
    tables: string[]
    columns: string[]
    schemas: string[]
  }
  /** Show the format toolbar above the editor */
  showToolbar?: boolean
  /** Enable right-click context menu */
  enableContextMenu?: boolean
}

export type SqlEditorRef = {
  format: () => void
  minify: () => void
  getContent: () => string
  setContent: (content: string) => void
}

export const SqlEditor = forwardRef<SqlEditorRef, SqlEditorProps>(function SqlEditor(
  { value, onChange, schema, showToolbar = true, enableContextMenu = true },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { theme } = useTheme()
  const [contextMenuOpen, setContextMenuOpen] = useState(false)

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    format: () => {
      const result = prettifySQL(value)
      if (result.success) {
        onChange(result.formatted)
      }
    },
    minify: () => {
      const result = minifySQL(value)
      if (result.success) {
        onChange(result.formatted)
      }
    },
    getContent: () => value,
    setContent: (content: string) => onChange(content),
  }))

  // Format handler
  const handleFormat = useCallback(() => {
    const result = prettifySQL(value)
    if (result.success) {
      onChange(result.formatted)
    }
  }, [value, onChange])

  // Minify handler
  const handleMinify = useCallback(() => {
    const result = minifySQL(value)
    if (result.success) {
      onChange(result.formatted)
    }
  }, [value, onChange])

  // Format as JSON (for JSON columns/results)
  const handleFormatAsJSON = useCallback(() => {
    const result = prettifyJSON(value)
    if (result.success) {
      onChange(result.formatted)
    }
  }, [value, onChange])

  // Copy handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [value])

  // Cut handler
  const handleCut = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      onChange('')
    } catch (error) {
      console.error('Failed to cut:', error)
    }
  }, [value, onChange])

  // Paste handler
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const currentPos = viewRef.current?.state.selection.main.head || 0
      const before = value.slice(0, currentPos)
      const after = value.slice(currentPos)
      onChange(before + text + after)
    } catch (error) {
      console.error('Failed to paste:', error)
    }
  }, [value, onChange])

  // Keyboard shortcut handler
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Shift+Alt+F for format
      if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        handleFormat()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleFormat])

  useEffect(() => {
    if (!editorRef.current) return

    const completions = schema
      ? [
        ...schema.tables.map((name) => ({ label: name, type: 'table' })),
        ...schema.columns.map((name) => ({ label: name, type: 'column' })),
        ...schema.schemas.map((name) => ({ label: name, type: 'schema' })),
      ]
      : []

    const sqlCompletion = autocompletion({
      override: [
        (context) => {
          const word = context.matchBefore(/\w*/)
          if (!word || (word.from === word.to && !context.explicit)) return null
          return {
            from: word.from,
            options: completions,
          }
        },
      ],
    })

    const extensions = [
      basicSetup,
      sql(),
      sqlCompletion,
      EditorView.updateListener.of((update: any) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    ]

    if (theme === 'dark') {
      extensions.push(oneDark)
    } else {
      // Light theme styling
      extensions.push(EditorView.theme({
        '&': {
          color: 'var(--foreground)',
          backgroundColor: 'var(--card)',
        },
        '.cm-content': {
          caretColor: 'var(--foreground)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--surface)',
          color: 'var(--muted-foreground)',
          border: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#e9ecef',
        },
        '.cm-line': {
          padding: '0 0.5em',
        },
        '.cm-focused': {
          outline: '1px solid #007acc',
          outlineOffset: '-1px',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: '#b3d4fc',
        },
        '.cm-keyword': {
          color: '#0000ff',
          fontWeight: 'bold',
        },
        '.cm-string': {
          color: '#008000',
        },
        '.cm-number': {
          color: '#ff6600',
        },
        '.cm-comment': {
          color: '#999999',
          fontStyle: 'italic',
        },
        '.cm-variableName': {
          color: '#333333',
        },
        '.cm-atom': {
          color: '#ff6600',
        },
        '.cm-property': {
          color: '#333333',
        },
        '.cm-operator': {
          color: '#333333',
        },
        '.cm-punctuation': {
          color: '#333333',
        },
        '.cm-bracket': {
          color: '#333333',
        },
      }))
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
    }
  }, [schema, theme])

  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString()
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        })
      }
    }
  }, [value])

  const editorContent = (
    <div className="h-full w-full overflow-auto rounded-md border bg-background shadow-sm flex flex-col">
      {showToolbar && (
        <div className="flex items-center justify-between border-b border-border-light bg-muted px-2 py-1">
          <span className="text-xs text-muted-foreground font-medium">SQL Editor</span>
          <EditorToolbar
            content={value}
            onFormat={onChange}
            language="postgresql"
            compact
          />
        </div>
      )}
      <div ref={editorRef} className="flex-1 min-h-0" />
    </div>
  )

  if (!enableContextMenu) {
    return editorContent
  }

  return (
    <ContextMenu onOpenChange={setContextMenuOpen}>
      <div className="h-full w-full">
        {editorContent}
      </div>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Edit</ContextMenuLabel>
        <ContextMenuItem onClick={handleCut} disabled={!value}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy} disabled={!value}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuLabel>Format</ContextMenuLabel>
        <ContextMenuItem onClick={handleFormat} disabled={!value.trim()}>
          <Wand2 className="mr-2 h-4 w-4" />
          Prettify SQL
          <ContextMenuShortcut>⇧⌥F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMinify} disabled={!value.trim()}>
          <Minimize2 className="mr-2 h-4 w-4" />
          Minify SQL
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuLabel>Format As</ContextMenuLabel>
        <ContextMenuItem onClick={handleFormat} disabled={!value.trim()}>
          <Database className="mr-2 h-4 w-4" />
          SQL (PostgreSQL)
        </ContextMenuItem>
        <ContextMenuItem onClick={handleFormatAsJSON} disabled={!value.trim()}>
          <FileJson className="mr-2 h-4 w-4" />
          JSON
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
