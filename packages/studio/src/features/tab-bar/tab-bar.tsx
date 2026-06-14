import type { Tab } from '@studio/core/tabs'
import type { ReactNode } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@studio/shared/ui/context-menu'

type Props = {
  tabs: Tab[]
  activeTabId: string | null
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
  onTabPinToggle?: (id: string) => void
  onCloseOtherTabs?: (id: string) => void
  onCloseTabsToLeft?: (id: string) => void
  onCloseTabsToRight?: (id: string) => void
  onTabReorder?: (fromId: string, toId: string) => void
  rightSlot?: ReactNode
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabPinToggle,
  onCloseOtherTabs,
  onCloseTabsToLeft,
  onCloseTabsToRight,
  onTabReorder,
  rightSlot,
}: Props) {
  return (
    <div
      className="flex items-center h-9 border-b border-border bg-sidebar shrink-0 select-none"
      data-tauri-drag-region="true"
    >
      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto scrollbar-none">
        {tabs.map((tab, index) => {
          const hasClosableLeftTab = tabs.slice(0, index).some((item) => !item.pinned)
          const hasClosableRightTab = tabs.slice(index + 1).some((item) => !item.pinned)
          const hasClosableOtherTab = tabs.some((item) => item.id !== tab.id && !item.pinned)

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    'flex items-center h-full shrink-0 border-r border-border transition-colors',
                    tab.id === activeTabId
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                  )}
                  data-tauri-drag-region="false"
                  draggable={Boolean(onTabReorder)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', tab.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (onTabReorder) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromId = e.dataTransfer.getData('text/plain')
                    if (fromId && fromId !== tab.id) onTabReorder?.(fromId, tab.id)
                  }}
                >
                  <button
                    onClick={() => onTabClick(tab.id)}
                    className="flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium"
                    data-tauri-drag-region="false"
                  >
                    {tab.pinned ? <Pin className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                    <span className="max-w-[120px] truncate">{tab.label}</span>
                  </button>
                  <button
                    aria-label={`Close ${tab.label}`}
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                    onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onTabClose(tab.id) } }}
                    className="h-full px-1 pr-2 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
                    data-tauri-drag-region="false"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem onClick={() => onTabPinToggle?.(tab.id)} disabled={!onTabPinToggle}>
                  {tab.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {tab.pinned ? 'Unpin tab' : 'Pin tab'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTabClose(tab.id)}>
                  <X className="h-4 w-4" />
                  Close
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onCloseOtherTabs?.(tab.id)}
                  disabled={!onCloseOtherTabs || !hasClosableOtherTab}
                >
                  Close others
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onCloseTabsToLeft?.(tab.id)}
                  disabled={!onCloseTabsToLeft || !hasClosableLeftTab}
                >
                  Close tabs to left
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onCloseTabsToRight?.(tab.id)}
                  disabled={!onCloseTabsToRight || !hasClosableRightTab}
                >
                  Close tabs to right
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
      {rightSlot ? (
        <div className="flex h-full shrink-0 items-center border-l border-border px-1" data-tauri-drag-region="false">
          {rightSlot}
        </div>
      ) : null}
    </div>
  )
}
