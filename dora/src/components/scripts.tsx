'use client'

import { useEffect, useState } from 'react'
import { FileText, Star, Trash2, Edit, Play } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { getScripts, deleteScript } from '@/lib/tauri-commands'
import type { Script } from '@/types/database'
import type { UUID } from '@/types/base'

type ScriptsProps = {
  connectionId?: UUID
  onExecute?: (query: string) => void
  onEdit?: (script: Script) => void
}

export function Scripts({ connectionId, onExecute, onEdit }: ScriptsProps) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)

  async function loadScripts() {
    try {
      const data = await getScripts(connectionId)
      setScripts(data)
    } catch (error) {
      console.error('Failed to load scripts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScripts()
  }, [connectionId])

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this script?')) return
    try {
      await deleteScript(id)
      await loadScripts()
    } catch (error) {
      console.error('Failed to delete script:', error)
    }
  }

  if (loading) {
    return <div className="p-4 text-muted-foreground text-sm">Loading scripts...</div>
  }

  if (scripts.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No saved scripts yet
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      {scripts.map((script) => (
        <Card key={script.id} className="hover:bg-accent/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{script.name}</CardTitle>
                {script.favorite && <Star className="h-4 w-4 text-warning fill-warning" />}
              </div>
              <div className="flex gap-1">
                {onExecute && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onExecute(script.query_text)}
                    className="h-8 w-8"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {onEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(script)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(script.id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          {script.description && (
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{script.description}</p>
            </CardContent>
          )}
          {script.tags && script.tags.length > 0 && (
            <CardContent className="pt-2">
              <div className="flex gap-1 flex-wrap">
                {script.tags.split(',').map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
