'use client'

import { useTabs } from '@/core/state'
import { Plus, X, Circle } from 'lucide-react'
import { Button } from './ui/button'
import { useState } from 'react'

export function ScriptTabs() {
  const { tabs, activeTabId, createNewScript, closeTab, switchToTab, renameScript } = useTabs()
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  function handleTabClick(tabId: string) {
    if (editingTabId === tabId) return
    if (editingTabId !== null) {
      setEditingTabId(null)
      setEditingName('')
    }
    switchToTab(tabId)
  }

  function handleTabClose(e: React.MouseEvent, tabId: string) {
    e.stopPropagation()
    closeTab(tabId)
  }

  function startEditingName(tabId: string, currentName: string) {
    setEditingTabId(tabId)
    setEditingName(currentName)
  }

  function finishEditingName() {
    if (editingTabId === null) return
    if (editingName.trim()) {
      renameScript(editingTabId, editingName.trim())
    }
    setEditingTabId(null)
    setEditingName('')
  }

  function handleNameKeydown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      finishEditingName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setEditingTabId(null)
      setEditingName('')
    }
  }

  return (
    <div className="flex items-center overflow-hidden border-b border-border/50 bg-background">
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id
          const isModified = tab.isDirty

          return (
            <div
              key={tab.id}
              className={`group relative flex max-w-48 min-w-0 items-center ${isActive
                  ? 'bg-card border-x border-border shadow-lg'
                  : 'bg-transparent hover:bg-muted/60'
                }`}
            >
              <button
                type="button"
                className={`relative flex min-w-0 flex-1 items-center gap-2 px-4 py-1.5 text-sm transition-all duration-200 ${isActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
                onClick={() => handleTabClick(tab.id)}
                onDoubleClick={() => startEditingName(tab.id, tab.title)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    handleTabClose(e, tab.id)
                  }
                }}
              >
                {editingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleNameKeydown}
                    onBlur={finishEditingName}
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 border-none bg-transparent p-0 text-sm font-medium shadow-none focus:border-transparent focus:ring-0 focus:outline-none"
                  />
                ) : (
                  <span className="truncate font-medium">{tab.title}</span>
                )}

                {isModified && (
                  <Circle className="h-1.5 w-1.5 flex-shrink-0 fill-amber-500 text-amber-500" />
                )}
              </button>

              {tabs.length > 1 && (
                <button
                  type="button"
                  className={`mr-2 flex-shrink-0 rounded p-1 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive ${isActive ? 'text-muted-foreground' : ''
                    }`}
                  onClick={(e) => handleTabClose(e, tab.id)}
                  title="Close tab"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {isActive && (
                <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-200" />
              )}
            </div>
          )
        })}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="border-l border-border/30 rounded-none hover:bg-muted/30"
        onClick={createNewScript}
        title="New Tab"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
