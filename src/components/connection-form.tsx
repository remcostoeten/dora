'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { SimpleToast, SimpleToastContainer } from './ui/simple-toast'
import { testConnection } from '@/lib/tauri-commands'
import {
  analyzeConnectionString,
  formatCorrectionMessage,
  suggestConnectionName,
  validateConnectionString,
} from '@/lib/connection-string-utils'
import type { DatabaseInfo, ConnectionInfo } from '@/types/database'

type ConnectionFormProps = {
  onSuccess?: (name: string, databaseInfo: DatabaseInfo) => void
  onCancel?: () => void
  editingConnection?: ConnectionInfo | null
}

export function ConnectionForm({ onSuccess, onCancel, editingConnection }: ConnectionFormProps) {
  const [name, setName] = useState('')
  const [dbType, setDbType] = useState<'postgres' | 'sqlite'>('postgres')
  const [connectionString, setConnectionString] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [correctionInfo, setCorrectionInfo] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: string } & Parameters<typeof SimpleToast>[0]>>([])

  // Load editing connection data
  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name)
      const dbType = editingConnection.database_type
      if ('Postgres' in dbType) {
        setDbType('postgres')
        setConnectionString(dbType.Postgres.connection_string)
      } else if ('SQLite' in dbType) {
        setDbType('sqlite')
        setDbPath(dbType.SQLite.db_path)
      }
    }
  }, [editingConnection])

  const addToast = (props: Omit<Parameters<typeof SimpleToast>[0], 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { ...props, id }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  // Handle connection string paste with auto-fill
  const handleConnectionStringPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    const analysis = analyzeConnectionString(pastedText)

    if (analysis.wasModified) {
      e.preventDefault()
      setConnectionString(analysis.cleaned)

      const message = formatCorrectionMessage(analysis)
      if (message) {
        setCorrectionInfo(message)
        addToast({
          title: 'Auto-corrected connection string',
          description: message,
          variant: 'info',
          duration: 5000
        })
      }

      // Auto-detect database type
      if (analysis.detectedType !== 'unknown' && analysis.detectedType !== dbType) {
        setDbType(analysis.detectedType)
        addToast({
          title: 'Database type detected',
          description: `Switched to ${analysis.detectedType === 'postgres' ? 'PostgreSQL' : 'SQLite'}`,
          variant: 'info',
          duration: 3000
        })
      }

      // Auto-suggest name if empty
      if (!name && analysis.detectedType !== 'unknown') {
        const suggestedName = suggestConnectionName(analysis.cleaned, analysis.detectedType)
        setName(suggestedName)
      }
    }
  }, [dbType, name])

  // Handle SQLite path paste with auto-fill
  const handleDbPathPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    const analysis = analyzeConnectionString(pastedText)

    if (analysis.wasModified) {
      e.preventDefault()
      setDbPath(analysis.cleaned)

      const message = formatCorrectionMessage(analysis)
      if (message) {
        setCorrectionInfo(message)
        addToast({
          title: 'Auto-corrected path',
          description: message,
          variant: 'info',
          duration: 5000
        })
      }

      // Auto-suggest name if empty
      if (!name) {
        const suggestedName = suggestConnectionName(analysis.cleaned, 'sqlite')
        setName(suggestedName)
      }
    }
  }, [name])

  // Validate on change
  const handleConnectionStringChange = useCallback((value: string) => {
    setConnectionString(value)
    setCorrectionInfo(null)

    if (value) {
      const validation = validateConnectionString(value, 'postgres')
      setValidationError(validation.valid ? null : validation.error || null)
    } else {
      setValidationError(null)
    }
  }, [])

  const handleDbPathChange = useCallback((value: string) => {
    setDbPath(value)
    setCorrectionInfo(null)

    if (value) {
      const validation = validateConnectionString(value, 'sqlite')
      setValidationError(validation.valid ? null : validation.error || null)
    } else {
      setValidationError(null)
    }
  }, [])

  async function handleTest() {
    setTesting(true)
    setError(null)
    try {
      const databaseInfo: DatabaseInfo =
        dbType === 'sqlite'
          ? { SQLite: { db_path: dbPath } }
          : { Postgres: { connection_string: connectionString } }

      await testConnection(databaseInfo)
      addToast({
        title: 'Connection successful!',
        description: `Successfully connected to ${dbType === 'sqlite' ? 'SQLite' : 'PostgreSQL'} database.`,
        variant: 'success',
        duration: 4000
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      addToast({
        title: 'Connection failed',
        description: err instanceof Error ? err.message : 'Failed to connect to database',
        variant: 'error',
        duration: 6000
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const databaseInfo: DatabaseInfo =
        dbType === 'sqlite'
          ? { SQLite: { db_path: dbPath } }
          : { Postgres: { connection_string: connectionString } }

      onSuccess?.(name, databaseInfo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection')
    } finally {
      setLoading(false)
    }
  }

  const isValid = dbType === 'sqlite'
    ? dbPath.trim().length > 0
    : connectionString.trim().length > 0 && !validationError

  return (
    <>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{editingConnection ? 'Edit Connection' : 'New Connection'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Connection Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Database"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Paste a connection string below to auto-suggest a name
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Database Type</label>
              <Select value={dbType} onValueChange={(value) => setDbType(value as 'postgres' | 'sqlite')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgres">PostgreSQL</SelectItem>
                  <SelectItem value="sqlite">SQLite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dbType === 'sqlite' ? (
              <div>
                <label className="text-sm font-medium mb-2 block">Database Path</label>
                <Input
                  value={dbPath}
                  onChange={(e) => handleDbPathChange(e.target.value)}
                  onPaste={handleDbPathPaste}
                  placeholder="/path/to/database.db"
                  required
                  className={validationError ? 'border-error' : ''}
                />
                {validationError && (
                  <p className="text-xs text-error mt-1">{validationError}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Connection String
                </label>
                <Input
                  value={connectionString}
                  onChange={(e) => handleConnectionStringChange(e.target.value)}
                  onPaste={handleConnectionStringPaste}
                  placeholder="postgresql://user:password@localhost:5432/database"
                  required
                  className={validationError ? 'border-error' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste DATABASE_URL= or similar — prefixes are auto-stripped
                </p>
                {validationError && (
                  <p className="text-xs text-error mt-1">{validationError}</p>
                )}
              </div>
            )}

            {correctionInfo && (
              <div className="text-sm text-info bg-info/10 border border-info/20 p-3 rounded-md flex items-start gap-2">
                <span className="text-info">ℹ</span>
                <span>{correctionInfo}</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-error bg-error/10 border border-error/20 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={testing || loading || !isValid}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button type="submit" disabled={loading || testing || !isValid}>
                {loading ? 'Saving...' : editingConnection ? 'Update Connection' : 'Create Connection'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <SimpleToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
