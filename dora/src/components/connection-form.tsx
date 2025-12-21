'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { SimpleToast, SimpleToastContainer } from './ui/simple-toast'
import { testConnection } from '@/lib/tauri-commands'
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
                  onChange={(e) => setDbPath(e.target.value)}
                  placeholder="/path/to/database.db"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Connection String
                </label>
                <Input
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://user:password@localhost:5432/database"
                  required
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-error bg-error-light p-3 rounded-md">
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
                disabled={testing || loading}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button type="submit" disabled={loading || testing}>
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
