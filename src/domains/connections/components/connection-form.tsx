'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import type { ConnectionFormProps } from '../types'

export function ConnectionForm({ connection, onSubmit, onCancel, loading = false }: ConnectionFormProps) {
  const [name, setName] = useState('')
  const [dbType, setDbType] = useState<'postgres' | 'sqlite'>('postgres')
  const [connectionString, setConnectionString] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [color, setColor] = useState<number | null>(null)

  // Load connection data if editing
  useEffect(() => {
    if (connection) {
      setName(connection.name)
      setColor(connection.color ? parseInt(connection.color) : null)
      const dbType = connection.database_type
      if ('Postgres' in dbType) {
        setDbType('postgres')
        setConnectionString(dbType.Postgres.connection_string)
      } else if ('SQLite' in dbType) {
        setDbType('sqlite')
        setDbPath(dbType.SQLite.db_path)
      }
    }
  }, [connection])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const databaseInfo = dbType === 'postgres' 
      ? { Postgres: { connection_string: connectionString } }
      : { SQLite: { db_path: dbPath } }

    onSubmit({
      name,
      database_type: databaseInfo,
      connected: false,
      color: color?.toString(),
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {connection ? 'Edit Connection' : 'New Connection'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Connection name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dbType">Database Type</Label>
            <Select value={dbType} onValueChange={(value: 'postgres' | 'sqlite') => setDbType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dbType === 'postgres' ? (
            <div className="space-y-2">
              <Label htmlFor="connectionString">Connection String</Label>
              <Input
                id="connectionString"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="postgresql://user:password@localhost:5432/database"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dbPath">Database Path</Label>
              <Input
                id="dbPath"
                value={dbPath}
                onChange={(e) => setDbPath(e.target.value)}
                placeholder="/path/to/database.db"
                required
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : connection ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
