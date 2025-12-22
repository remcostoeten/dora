"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import type { DbConnection, DbType } from "@/shared/types"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: DbConnection | null
  onSubmit: (data: Omit<DbConnection, "id" | "status"> | ({ id: string } & Partial<DbConnection>)) => void
}

const dbTypes: { value: DbType; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "libsql", label: "LibSQL (Turso)" },
]

export function ConnForm({ open, onOpenChange, connection, onSubmit }: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<DbType>("postgresql")
  const [host, setHost] = useState("")
  const [database, setDatabase] = useState("")

  const isEdit = !!connection

  useEffect(() => {
    if (connection) {
      setName(connection.name)
      setType(connection.type)
      setHost(connection.host || "")
      setDatabase(connection.database)
    } else {
      setName("")
      setType("postgresql")
      setHost("")
      setDatabase("")
    }
  }, [connection, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEdit && connection) {
      onSubmit({
        id: connection.id,
        name,
        type,
        host: type === "postgresql" ? host : undefined,
        database,
      })
    } else {
      onSubmit({
        name,
        type,
        host: type === "postgresql" ? host : undefined,
        database,
      })
    }

    onOpenChange(false)
  }

  const requiresHost = type === "postgresql"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {isEdit ? "Edit Connection" : "New Connection"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="Production, Local Dev, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Database Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DbType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dbTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requiresHost && (
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  placeholder="db.example.com:5432"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required={requiresHost}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                placeholder={type === "sqlite" ? "dev.db" : type === "libsql" ? "my-db.turso.io" : "app_production"}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save Changes" : "Add Connection"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
