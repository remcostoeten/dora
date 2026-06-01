import type { Tab } from '@studio/core/tabs'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'

type Props = {
  tabs: Tab[]
  activeTabId: string | null
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
  rightSlot?: ReactNode
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, rightSlot }: Props) {
  return (
    <div
      className="flex items-center h-9 border-b border-border bg-sidebar shrink-0 select-none"
      data-tauri-drag-region="true"
    >
      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'flex items-center h-full shrink-0 border-r border-border transition-colors',
              tab.id === activeTabId
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            )}
            data-tauri-drag-region="false"
          >
            <button
              onClick={() => onTabClick(tab.id)}
              className="flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium"
              data-tauri-drag-region="false"
            >
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
        ))}
      </div>
      {rightSlot ? (
        <div className="flex h-full shrink-0 items-center border-l border-border px-1" data-tauri-drag-region="false">
          {rightSlot}
        </div>
      ) : null}
    </div>
  )
}
