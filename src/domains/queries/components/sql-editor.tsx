'use client'

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
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
import { EditorToolbar } from './editor-toolbar'
import { prettifySQL, minifySQL, prettifyJSON } from '@/core/formatters'
import { Wand2, Minimize2, Copy, Clipboard, Scissors, Database, FileJson } from 'lucide-react'

type Props = {
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

export const SqlEditor = forwardRef<SqlEditorRef, Props>(function SqlEditor(
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
      // Dark theme styling - uses CSS variables for theme awareness
      extensions.push(EditorView.theme({
        '&': {
          color: 'var(--foreground)',
          backgroundColor: 'var(--card)',
        },
        '.cm-content': {
          caretColor: 'var(--primary)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--primary)',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--muted-foreground)',
          border: 'none',
          minWidth: '2.5em',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 8px 0 8px',
          minWidth: '2em',
          textAlign: 'right',
          opacity: '0.6',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--primary-subtle)',
          color: 'var(--primary)',
          opacity: '1',
        },
        '.cm-activeLine': {
          backgroundColor: 'var(--primary-subtle)',
        },
        '.cm-line': {
          padding: '0 0.5em',
        },
        '.cm-focused': {
          outline: '2px solid var(--primary)',
          outlineOffset: '-2px',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'var(--primary-muted)',
        },
        '.cm-matchingBracket': {
          backgroundColor: 'var(--primary-subtle)',
          outline: '1px solid var(--primary-light)',
        },
        // SQL syntax highlighting with theme colors - High contrast for readability
        '.cm-keyword': {
          color: 'oklch(0.85 0.15 var(--primary-hue))', // Bright primary
          fontWeight: 'bold',
        },
        '.cm-string': {
          color: 'oklch(0.85 0.12 150)', // Bright green
        },
        '.cm-number': {
          color: 'oklch(0.90 0.15 55)', // Bright orange/gold
        },
        '.cm-comment': {
          color: 'var(--muted-foreground)',
          fontStyle: 'italic',
        },
        '.cm-variableName': {
          color: 'var(--foreground)',
        },
        '.cm-atom': {
          color: 'oklch(0.90 0.15 55)', // Bright orange/gold
        },
        '.cm-property': {
          color: 'oklch(0.80 0.12 var(--primary-hue))', // Lighter primary
        },
        '.cm-operator': {
          color: 'oklch(0.90 0.05 var(--primary-hue))', // Very bright primary
        },
        '.cm-punctuation': {
          color: 'var(--muted-foreground)',
        },
        '.cm-bracket': {
          color: 'var(--primary-light)',
        },
      }, { dark: true }))
    } else {
      // Light theme styling - uses CSS variables for theme awareness
      extensions.push(EditorView.theme({
        '&': {
          color: 'var(--foreground)',
          backgroundColor: 'var(--card)',
        },
        '.cm-content': {
          caretColor: 'var(--primary)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--primary)',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--muted-foreground)',
          border: 'none',
          minWidth: '2.5em',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 8px 0 8px',
          minWidth: '2em',
          textAlign: 'right',
          opacity: '0.6',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--primary-subtle)',
          color: 'var(--primary)',
          opacity: '1',
        },
        '.cm-activeLine': {
          backgroundColor: 'var(--primary-subtle)',
        },
        '.cm-line': {
          padding: '0 0.5em',
        },
        '.cm-focused': {
          outline: '2px solid var(--primary)',
          outlineOffset: '-2px',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'var(--primary-muted)',
        },
        '.cm-matchingBracket': {
          backgroundColor: 'var(--primary-subtle)',
          outline: '1px solid var(--primary-light)',
        },
        // SQL syntax highlighting with theme colors
        '.cm-keyword': {
          color: 'var(--primary)',
          fontWeight: 'bold',
        },
        '.cm-string': {
          color: 'var(--success)',
        },
        '.cm-number': {
          color: 'var(--warning)',
        },
        '.cm-comment': {
          color: 'var(--muted-foreground)',
          fontStyle: 'italic',
        },
        '.cm-variableName': {
          color: 'var(--foreground)',
        },
        '.cm-atom': {
          color: 'var(--warning)',
        },
        '.cm-property': {
          color: 'var(--primary-dark)',
        },
        '.cm-operator': {
          color: 'var(--primary-light)',
        },
        '.cm-punctuation': {
          color: 'var(--muted-foreground)',
        },
        '.cm-bracket': {
          color: 'var(--primary-light)',
        },
      }))
    }

    // Pad with newlines to show at least 30 line numbers
    // If empty, add a placeholder query on line 1
    const minLines = 30
    const effectiveValue = value.trim() === ''
      ? 'SELECT * FROM your_table LIMIT 100;'
      : value
    const currentLines = effectiveValue.split('\n').length
    const paddedValue = currentLines >= minLines
      ? effectiveValue
      : effectiveValue + '\n'.repeat(minLines - currentLines)

    const state = EditorState.create({
      doc: paddedValue,
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
