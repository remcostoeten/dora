import type { Tab } from '@/core/tabs'
import { X } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

type Props = {
  tabs: Tab[]
  activeTabId: string | null
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: Props) {
  if (tabs.length === 0) return null

  return (
    <div className="flex items-center h-9 border-b border-border bg-sidebar overflow-x-auto shrink-0 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={cn(
            'flex items-center gap-1.5 h-full px-3 text-xs font-medium shrink-0 border-r border-border transition-colors',
            tab.id === activeTabId
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <span className="max-w-[120px] truncate">{tab.label}</span>
          <button
            aria-label={`Close ${tab.label}`}
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onTabClose(tab.id) } }}
            className="rounded hover:bg-sidebar-accent p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  )
}
