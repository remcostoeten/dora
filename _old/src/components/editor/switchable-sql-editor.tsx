'use client'

import { useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { SqlEditor, SqlEditorRef } from './sql-editor'
import { MonacoSqlEditor, MonacoSqlEditorRef } from './monaco-sql-editor'
import { Button } from '@/components/ui/button'
import { Code2, FileJson2 } from 'lucide-react'

type EditorType = 'codemirror' | 'monaco'

type SwitchableSqlEditorProps = {
  value: string
  onChange: (value: string) => void
  schema?: {
    tables: string[]
    columns: string[]
    schemas: string[]
  }
  showToolbar?: boolean
  enableContextMenu?: boolean
}

export type SwitchableSqlEditorRef = {
  format: () => void
  minify: () => void
  getContent: () => string
  setContent: (content: string) => void
}

export const SwitchableSqlEditor = forwardRef<SwitchableSqlEditorRef, SwitchableSqlEditorProps>(
  function SwitchableSqlEditor(props, ref) {
    const [editorType, setEditorType] = useState<EditorType>('codemirror')
    const codeMirrorRef = useRef<SqlEditorRef>(null)
    const monacoRef = useRef<MonacoSqlEditorRef>(null)

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      format: () => {
        if (editorType === 'codemirror') {
          codeMirrorRef.current?.format()
        } else {
          monacoRef.current?.format()
        }
      },
      minify: () => {
        if (editorType === 'codemirror') {
          codeMirrorRef.current?.minify()
        } else {
          monacoRef.current?.minify()
        }
      },
      getContent: () => props.value,
      setContent: (content: string) => props.onChange(content),
    }), [editorType, props])



    const editorContent = (
      <div className="h-full w-full overflow-auto rounded-md border bg-background shadow-sm flex flex-col">
        <div className="flex items-center justify-between border-b border-border-light bg-muted px-2 py-1">
          <span className="text-xs text-muted-foreground font-medium">
            {editorType === 'codemirror' ? 'CodeMirror Editor' : 'Monaco Editor'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant={editorType === 'codemirror' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditorType('codemirror')}
              className="h-6 px-2 text-xs"
            >
              <Code2 className="h-3 w-3 mr-1" />
              CodeMirror
            </Button>
            <Button
              variant={editorType === 'monaco' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditorType('monaco')}
              className="h-6 px-2 text-xs"
            >
              <FileJson2 className="h-3 w-3 mr-1" />
              Monaco
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {editorType === 'codemirror' ? (
            <SqlEditor
              ref={codeMirrorRef}
              {...props}
              showToolbar={false}
            />
          ) : (
            <MonacoSqlEditor
              ref={monacoRef}
              {...props}
              showToolbar={false}
            />
          )}
        </div>
      </div>
    )

    return editorContent
  }
)