"use client"

import { useEffect, useRef, useState } from "react"
import Editor, { type OnMount, loader } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { EditorSkeleton } from "./editor-skeleton"
import { validateSQL } from "@/shared/lib/sql-validator"

type Props = {
  value: string
  onChange: (value: string) => void
  language?: string
  readOnly?: boolean
  onValidationChange?: (hasErrors: boolean) => void
}

if (typeof window !== "undefined") {
  loader.init()
}

export function MonacoEditor({ value, onChange, language = "sql", readOnly = false, onValidationChange }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null)
  const [isEditorReady, setIsEditorReady] = useState(false)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setIsEditorReady(true)

    // Configure SQL language features
    monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: () => {
        const suggestions: any[] = [
          {
            label: "SELECT",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "SELECT ",
          },
          {
            label: "FROM",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "FROM ",
          },
          {
            label: "WHERE",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "WHERE ",
          },
          {
            label: "INSERT INTO",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "INSERT INTO ",
          },
          {
            label: "UPDATE",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "UPDATE ",
          },
          {
            label: "DELETE FROM",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "DELETE FROM ",
          },
          {
            label: "JOIN",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "JOIN ",
          },
          {
            label: "LEFT JOIN",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "LEFT JOIN ",
          },
          {
            label: "ORDER BY",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "ORDER BY ",
          },
          {
            label: "LIMIT",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "LIMIT ",
          },
        ]
        return { suggestions }
      },
    })

    // Custom theme
    monaco.editor.defineTheme("database-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword.sql", foreground: "C792EA", fontStyle: "bold" },
        { token: "string.sql", foreground: "C3E88D" },
        { token: "number.sql", foreground: "F78C6C" },
        { token: "operator.sql", foreground: "89DDFF" },
        { token: "comment", foreground: "676E95", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#09090b",
        "editor.foreground": "#a1a1aa",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#a1a1aa",
        "editor.selectionBackground": "#27272a",
        "editor.inactiveSelectionBackground": "#18181b",
        "editorCursor.foreground": "#a1a1aa",
      },
    })

    monaco.editor.setTheme("database-dark")

    const validateAndSetMarkers = () => {
      const model = editor.getModel()
      if (!model) return

      const content = model.getValue()
      const errors = validateSQL(content)

      const markers: editor.IMarkerData[] = errors.map((error) => ({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: error.line,
        startColumn: error.column,
        endLineNumber: error.line,
        endColumn: error.column + 10,
        message: error.suggestion ? `${error.message}. Did you mean '${error.suggestion}'?` : error.message,
      }))

      monaco.editor.setModelMarkers(model, "sql-validator", markers)
      onValidationChange?.(markers.length > 0)
    }

    // Validate on mount
    validateAndSetMarkers()

    // Validate on content change
    editor.onDidChangeModelContent(() => {
      validateAndSetMarkers()
    })
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.layout()
    }
  }, [])

  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      value={value}
      onChange={(val) => onChange(val || "")}
      onMount={handleEditorDidMount}
      loading={<EditorSkeleton />}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "ui-monospace, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        readOnly,
        wordWrap: "on",
        wrappingIndent: "same",
        scrollbar: {
          vertical: "visible",
          horizontal: "visible",
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        renderLineHighlight: "all",
        roundedSelection: false,
        padding: { top: 8, bottom: 8 },
      }}
    />
  )
}
