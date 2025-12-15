import { useState, useEffect } from 'react'
import { useToast } from '@/shared/components/ui/toast'
import type { Script } from '../types'
import * as scriptCommands from '../api/script-commands'

export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()

  const loadScripts = async () => {
    setLoading(true)
    try {
      const data = await scriptCommands.getScripts()
      setScripts(data)
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to load scripts',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const addScript = async (script: Omit<Script, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newScript = await scriptCommands.saveScript(script)
      setScripts(prev => [...prev, newScript])
      return newScript
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to save script',
        variant: 'error'
      })
      throw error
    }
  }

  const updateScript = async (id: number, updates: Partial<Script>) => {
    try {
      const updated = await scriptCommands.updateScript(id, updates)
      setScripts(prev => prev.map(script => script.id === id ? updated : script))
      return updated
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to update script',
        variant: 'error'
      })
      throw error
    }
  }

  const deleteScript = async (id: number) => {
    try {
      await scriptCommands.deleteScript(id)
      setScripts(prev => prev.filter(script => script.id !== id))
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to delete script',
        variant: 'error'
      })
      throw error
    }
  }

  // Calculate unsaved changes (this would be managed by tabs in real implementation)
  const unsavedChanges = new Set<number>()

  useEffect(() => {
    loadScripts()
  }, [])

  return {
    scripts,
    loading,
    unsavedChanges,
    loadScripts,
    addScript,
    updateScript,
    deleteScript,
    // Additional methods needed by app state
    openScript: (script: Script) => {
      // This would be handled by the tabs system
      console.log('Opening script:', script.name)
    },
    handleEditorContentChange: (content: string) => {
      // This would be handled by the editor/tabs system
      console.log('Editor content changed:', content)
    },
    markScriptSaved: (id: number) => {
      // This would be handled by the tabs system
      console.log('Marking script as saved:', id)
    },
    createNewScript: () => {
      // This would create a new script and open it in a tab
      console.log('Creating new script')
    },
  }
}
