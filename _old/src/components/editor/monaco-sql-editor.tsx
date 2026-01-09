'use client'

import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import Editor from '@monaco-editor/react'
import { useTheme } from '@/core/state'
import { EditorToolbar } from './editor-toolbar'
import { prettifySQL, minifySQL, prettifyJSON } from '@/core/formatters'

type MonacoSqlEditorProps = {
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

export type MonacoSqlEditorRef = {
  format: () => void
  minify: () => void
  getContent: () => string
  setContent: (content: string) => void
}

export const MonacoSqlEditor = forwardRef<MonacoSqlEditorRef, MonacoSqlEditorProps>(function MonacoSqlEditor(
  { value, onChange, schema, showToolbar = true, enableContextMenu = true },
  ref
) {
  const editorRef = useRef<any>(null)
  const { theme } = useTheme()

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

  const handleFormat = useCallback(() => {
    const result = prettifySQL(value)
    if (result.success) {
      onChange(result.formatted)
    }
  }, [value, onChange])

  const handleMinify = useCallback(() => {
    const result = minifySQL(value)
    if (result.success) {
      onChange(result.formatted)
    }
  }, [value, onChange])



  // Configure Monaco editor
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor

    // Configure SQL language
    monaco.languages.register({ id: 'sql' })

    // Configure SQL syntax highlighting
    monaco.languages.setMonarchTokensProvider('sql', {
      tokenizer: {
        root: [
          [/SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|TRUE|FALSE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|DISTINCT|ALL|EXISTS|CASE|WHEN|THEN|ELSE|END|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|WITH|RECURSIVE|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|AUTO_INCREMENT|SERIAL|IF|EXISTS|TEMPORARY|TEMP|VIEW|FUNCTION|PROCEDURE|TRIGGER|GRANT|REVOKE|COMMIT|ROLLBACK|TRANSACTION|BEGIN|SAVEPOINT|RELEASE/i, 'keyword'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
          [/'[^']*'/, 'string'],
          [/\"[^\"]*\"/, 'string'],
          [/\d+/, 'number'],
          [/--.*/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/[;,\(\)]/, 'delimiter'],
          [/[+\-*\/=<>!]/, 'operator'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment'],
        ],
      },
    })

    // Set up autocompletion for schema items
    if (schema) {
      monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: () => {
          const suggestions = [
            ...schema.tables.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: name,
              detail: 'Table',
            })),
            ...schema.columns.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: name,
              detail: 'Column',
            })),
            ...schema.schemas.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: name,
              detail: 'Schema',
            })),
          ]

          return { suggestions }
        },
      })
    }

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormat()
    })

    // Set up word wrap
    editor.updateOptions({
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace',
    })
  }, [theme, schema, handleFormat])

  const editorContent = (
    <div className="h-full w-full overflow-auto rounded-md border bg-background shadow-sm flex flex-col">
      {showToolbar && (
        <div className="flex items-center justify-between border-b border-border-light bg-muted px-2 py-1">
          <span className="text-xs text-muted-foreground font-medium">Monaco Editor</span>
          <EditorToolbar
            content={value}
            onFormat={onChange}
            language="postgresql"
            compact
          />
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="sql"
          value={value || 'SELECT * FROM your_table LIMIT 100;'}
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            selectOnLineNumbers: true,
            automaticLayout: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace',
            tabSize: 2,
            insertSpaces: true,
            contextmenu: enableContextMenu,
          }}
        />
      </div>
    </div>
  )

  return editorContent
})