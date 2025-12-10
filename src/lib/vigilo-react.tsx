import React, { useMemo } from 'react'

export type TodoStatus = 'todo' | 'working' | 'done'

export type VigiloItem = {
  text: string
  status?: TodoStatus
}

export type CategoryConfig = {
  id: string
  displayName?: string
  items?: VigiloItem[]
  defaultStatus?: TodoStatus
  allowConnections?: boolean
  color?: string
}

export type VigiloProps = {
  category: string
  instanceId?: string
  categories?: CategoryConfig[]
  colorMode?: 'auto' | 'light' | 'dark'
}

function badgeColor(status?: TodoStatus) {
  switch (status) {
    case 'done':
      return 'bg-emerald-100 text-emerald-800'
    case 'working':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

export function Vigilo({ category, instanceId, categories = [] }: VigiloProps) {
  const activeCategory = useMemo(
    () => categories.find((cat) => cat.id === category) ?? categories[0],
    [categories, category]
  )

  const items = activeCategory?.items ?? []

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vigilo</p>
          <h2 className="text-lg font-semibold text-foreground">
            {activeCategory?.displayName || activeCategory?.id || 'Tasks'}
          </h2>
        </div>
        {instanceId && <span className="text-[10px] text-muted-foreground">{instanceId}</span>}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No tasks available for this category.</p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={`${item.text}-${index}`}
            className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
          >
            <span
              className={`mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full ${
                item.status === 'done'
                  ? 'bg-emerald-500'
                  : item.status === 'working'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
              }`}
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-foreground">{item.text}</p>
              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor(item.status)}`}>
                {item.status ?? activeCategory?.defaultStatus ?? 'todo'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function VigiloCommandPalette() {
  return null
}

export default Vigilo
