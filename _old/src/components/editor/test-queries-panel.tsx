'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Database, 
  Plus, 
  FileText, 
  Edit, 
  Trash2, 
  Eye,
  Zap,
  BarChart3,
  Play
} from 'lucide-react'
import { getScripts } from '@/core/tauri'
import type { Script } from '@/types/database'

interface TestQueriesPanelProps {
  onLoadQuery: (query: string) => void
  className?: string
}

const TEST_QUERY_IDS = [
  'CREATE Tables',
  'INSERT Data', 
  'READ Queries',
  'UPDATE Operations',
  'DELETE Operations',
  'Advanced Queries',
  'Performance Queries'
]

const getQueryIcon = (title: string) => {
  switch (title) {
    case 'CREATE Tables': return Database
    case 'INSERT Data': return Plus
    case 'READ Queries': return Eye
    case 'UPDATE Operations': return Edit
    case 'DELETE Operations': return Trash2
    case 'Advanced Queries': return Zap
    case 'Performance Queries': return BarChart3
    default: return FileText
  }
}

const getQueryColor = (title: string) => {
  switch (title) {
    case 'CREATE Tables': return 'bg-blue-500'
    case 'INSERT Data': return 'bg-green-500'
    case 'READ Queries': return 'bg-purple-500'
    case 'UPDATE Operations': return 'bg-orange-500'
    case 'DELETE Operations': return 'bg-red-500'
    case 'Advanced Queries': return 'bg-indigo-500'
    case 'Performance Queries': return 'bg-pink-500'
    default: return 'bg-gray-500'
  }
}

export function TestQueriesPanel({ onLoadQuery, className }: TestQueriesPanelProps) {
  const [testQueries, setTestQueries] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTestQueries = async () => {
      try {
        const scripts = await getScripts()
        const testQueryScripts = scripts.filter(script => 
          TEST_QUERY_IDS.includes(script.name)
        )
        setTestQueries(testQueryScripts)
      } catch (error) {
        console.error('Failed to load test queries:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTestQueries()
  }, [])

  const handleLoadQuery = (query: string) => {
    onLoadQuery(query)
  }

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-sm text-muted-foreground">
          Loading test queries...
        </div>
      </div>
    )
  }

  if (testQueries.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-sm text-muted-foreground">
            No test queries found
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            <Play className="h-3 w-3 mr-2" />
            Populate Test Queries
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Test Queries</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {testQueries.length}
          </span>
        </div>
        
        <div className="space-y-2">
          {testQueries.map((query, index) => {
            const Icon = getQueryIcon(query.name)
            const colorClass = getQueryColor(query.name)
            
            return (
              <div
                key={query.id}
                className="group rounded-lg border border-border hover:border-primary/50 transition-colors p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-md ${colorClass} bg-opacity-10`}>
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {query.name}
                      </h4>
                      {query.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {query.description}
                        </p>
                      )}
                      {query.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {query.tags.split(',').map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="text-xs border border-border px-1.5 py-0 rounded"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleLoadQuery(query.query_text)}
                      title="Load query"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    {query.favorite && (
                      <div className="h-4 w-4 text-yellow-500">
                        ⭐
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium">Keyboard Shortcuts:</div>
            <div>Ctrl+Shift+1-7: Load specific test queries</div>
            <div>Ctrl+Shift+P: Open command palette</div>
          </div>
        </div>
      </div>
    </div>
  )
}