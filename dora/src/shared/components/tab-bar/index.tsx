"use client"

import type React from "react"

import { useState } from "react"
import { X, Plus, Table, Terminal, GripVertical, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu"
import type { Tab, TabType } from "@/shared/types"
import { cn } from "@/shared/utils"

type Props = {
  tabs: Tab[]
  activeId: string
  onClick: (id: string) => void
  onClose: (id: string) => void
  onAddTab: (type: TabType) => void
  onReorderTabs?: (tabs: Tab[]) => void
  onCloseAll?: () => void
  onCloseLeft?: (id: string) => void
  onCloseRight?: (id: string) => void
}

export function TabBar({
  tabs,
  activeId,
  onClick,
  onClose,
  onAddTab,
  onReorderTabs,
  onCloseAll,
  onCloseLeft,
  onCloseRight,
}: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const activeIndex = tabs.findIndex((t) => t.id === activeId)
  const canNavigatePrev = activeIndex > 0
  const canNavigateNext = activeIndex < tabs.length - 1

  const navigatePrev = () => {
    if (canNavigatePrev) {
      onClick(tabs[activeIndex - 1].id)
    }
  }

  const navigateNext = () => {
    if (canNavigateNext) {
      onClick(tabs[activeIndex + 1].id)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDropTargetId(id)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    const draggedIdx = tabs.findIndex((t) => t.id === draggedId)
    const targetIdx = tabs.findIndex((t) => t.id === targetId)

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const newTabs = [...tabs]
      const [removed] = newTabs.splice(draggedIdx, 1)
      newTabs.splice(targetIdx, 0, removed)
      onReorderTabs?.(newTabs)
    }

    setDraggedId(null)
    setDropTargetId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDropTargetId(null)
  }

  return (
    <div className="flex h-9 items-stretch border-b border-border/60 bg-muted/30">
      <div className="flex items-stretch border-r border-border/60">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigatePrev}
          disabled={!canNavigatePrev}
          className="h-full rounded-none border-r border-border/60 px-2 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateNext}
          disabled={!canNavigateNext}
          className="h-full rounded-none px-2 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex h-full flex-1 items-stretch overflow-x-auto">
        {tabs.map((tab, idx) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                onClick={() => onClick(tab.id)}
                className={cn(
                  "group relative flex h-full cursor-pointer select-none items-center gap-1.5 border-r border-border/60 px-3 text-xs font-medium transition-colors",
                  activeId === tab.id
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  dropTargetId === tab.id && "ring-2 ring-primary/50 ring-inset",
                  draggedId === tab.id && "opacity-50",
                )}
              >
                {activeId === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}

                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-60" />

                {tab.type === "table" ? (
                  <Table className="h-3.5 w-3.5 shrink-0 opacity-60" />
                ) : (
                  <Terminal className="h-3.5 w-3.5 shrink-0 opacity-60" />
                )}

                <span className="max-w-32 truncate font-mono tracking-tight">{tab.name}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.id)
                  }}
                  className={cn(
                    "ml-auto rounded-sm p-0.5 transition-all duration-150",
                    "opacity-0 hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100",
                    activeId === tab.id && "opacity-60 hover:opacity-100",
                  )}
                  aria-label="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => onClick(tab.id)} className="text-xs">
                View
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onClose(tab.id)} className="text-xs">
                Close
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCloseLeft?.(tab.id)} disabled={idx === 0} className="text-xs">
                Close all to the left
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onCloseRight?.(tab.id)}
                disabled={idx === tabs.length - 1}
                className="text-xs"
              >
                Close all to the right
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCloseAll?.()} className="text-xs">
                Close all
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      <div className="flex items-stretch border-l border-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full rounded-none px-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onAddTab("table")} className="text-xs">
              <Table className="mr-2 h-3.5 w-3.5 opacity-50" />
              Table View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddTab("query")} className="text-xs">
              <Terminal className="mr-2 h-3.5 w-3.5 opacity-50" />
              SQL Query
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
