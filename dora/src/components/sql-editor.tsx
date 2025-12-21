'use client'

import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion } from '@codemirror/autocomplete'
import { useTheme } from '@/lib/theme-provider'

type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  schema?: {
    tables: string[]
    columns: string[]
    schemas: string[]
  }
}

export function SqlEditor({ value, onChange, schema }: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { theme } = useTheme()

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
          color: '#333333',
          backgroundColor: '#ffffff',
        },
        '.cm-content': {
          caretColor: '#333333',
        },
        '.cm-gutters': {
          backgroundColor: '#f8f9fa',
          color: '#6c757d',
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

  return (
    <div className="h-full w-full overflow-auto rounded-md border bg-background shadow-sm">
      <div ref={editorRef} className="h-full" />
    </div>
  )
}
