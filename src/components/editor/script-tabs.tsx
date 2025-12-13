'use client'

import { useTabs } from '@/core/state'
import { Plus, X, Circle, Pin, PinOff, FileJson2, TableProperties } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useRef, useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export function ScriptTabs() {
  const {
    tabs,
    activeTabId,
    createNewScript,
    closeTab,
    switchToTab,
    renameScript,
    pinTab,
    unpinTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeAllTabs,
    closeOtherTabs,
    reorderTabs,
  } = useTabs()

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    setDraggedTabIndex(index)

    // Use a ghost image
    const target = e.currentTarget as HTMLElement
    e.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)

    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex)
    }

    setDraggedTabIndex(null)
    setDragOverIndex(null)
  }, [reorderTabs])

  const handleDragEnd = useCallback(() => {
    setDraggedTabIndex(null)
    setDragOverIndex(null)
  }, [])

  // Get tab index for context menu actions
  const getTabIndex = (tabId: string): number => {
    return tabs.findIndex((t) => t.id === tabId)
  }

  // Check if there are tabs to the left that can be closed
  const hasClosableTabsToLeft = (tabId: string): boolean => {
    const index = getTabIndex(tabId)
    return tabs.slice(0, index).some((t) => !t.isPinned)
  }

  // Check if there are tabs to the right
  const hasTabsToRight = (tabId: string): boolean => {
    const index = getTabIndex(tabId)
    return index < tabs.length - 1
  }

  return (
    <div className="flex items-center overflow-hidden border-b border-border/50 bg-background">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id
          const isModified = tab.isDirty
          const isPinned = tab.isPinned
          const isDragging = draggedTabIndex === index
          const isDragOver = dragOverIndex === index

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  ref={(el) => {
                    if (el) tabRefs.current.set(tab.id, el)
                    else tabRefs.current.delete(tab.id)
                  }}
                  draggable={editingTabId !== tab.id}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group relative flex min-w-0 items-center transition-all duration-200 ${isPinned ? 'max-w-24' : 'max-w-48'
                    } ${isActive
                      ? 'bg-card border-x border-border shadow-lg'
                      : 'bg-transparent hover:bg-muted/60'
                    } ${isDragging ? 'opacity-50' : ''
                    } ${isDragOver ? 'border-l-2 border-l-primary' : ''
                    }`}
                >
                  <button
                    type="button"
                    className={`relative flex min-w-0 flex-1 items-center gap-2 px-4 py-1.5 text-sm transition-all duration-200 ${isActive
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                    onClick={() => handleTabClick(tab.id)}
                    onDoubleClick={() => !isPinned && startEditingName(tab.id, tab.title)}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        handleTabClose(e, tab.id)
                      }
                    }}
                  >
                    {isPinned && (
                      <Pin className="h-3 w-3 flex-shrink-0 text-primary" />
                    )}

                    {/* Tab type icon */}
                    {!isPinned && (
                      tab.type === 'table-view' ? (
                        <TableProperties className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                      ) : (
                        <FileJson2 className="h-3.5 w-3.5 flex-shrink-0 text-primary-light" />
                      )
                    )}

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

                  {tabs.length > 1 && !isPinned && (
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
                    <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary transition-all duration-200" />
                  )}
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={() => closeTab(tab.id)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => closeOtherTabs(tab.id)}
                  disabled={tabs.filter((t) => t.id !== tab.id && !t.isPinned).length === 0}
                >
                  Close Others
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => closeTabsToLeft(tab.id)}
                  disabled={!hasClosableTabsToLeft(tab.id)}
                >
                  Close to the Left
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => closeTabsToRight(tab.id)}
                  disabled={!hasTabsToRight(tab.id)}
                >
                  Close to the Right
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => closeAllTabs()}
                  disabled={tabs.filter((t) => !t.isPinned).length === 0}
                >
                  Close All
                </ContextMenuItem>

                <ContextMenuSeparator />

                {isPinned ? (
                  <ContextMenuItem onClick={() => unpinTab(tab.id)}>
                    <PinOff className="mr-2 h-4 w-4" />
                    Unpin
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem onClick={() => pinTab(tab.id)}>
                    <Pin className="mr-2 h-4 w-4" />
                    Pin
                  </ContextMenuItem>
                )}

                <ContextMenuSeparator />

                <ContextMenuItem onClick={createNewScript}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Tab
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}

        {/* + New button inline after tabs */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 flex h-8 items-center gap-1 rounded-sm px-2 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          onClick={createNewScript}
          title="New Tab"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">New</span>
        </Button>
      </div>
    </div>
  )
}
