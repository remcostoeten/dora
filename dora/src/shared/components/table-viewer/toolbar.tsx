"use client"

import { useState } from "react"
import { Filter, X, Plus } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import type { TableColumn, FilterConfig } from "@/shared/types"

type Props = {
  columns: TableColumn[]
  filters: FilterConfig[]
  onFiltersChange: (filters: FilterConfig[]) => void
}

const operators = [
  { value: "equals", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
]

export function Toolbar({ columns, filters, onFiltersChange }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const addFilter = () => {
    const newFilter: FilterConfig = {
      column: columns[0]?.name || "",
      operator: "contains",
      value: "",
    }
    onFiltersChange([...filters, newFilter])
  }

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    const newFilters = filters.map((f, i) => (i === index ? { ...f, ...updates } : f))
    onFiltersChange(newFilters)
  }

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index))
  }

  const clearFilters = () => {
    onFiltersChange([])
  }

  const activeCount = filters.filter((f) => f.value || f.operator === "is_null" || f.operator === "is_not_null").length

  return (
    <div className="flex items-center gap-2 border-b border-border/50 bg-card/50 px-3 py-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1.5 px-2 text-xs ${activeCount > 0 ? "text-primary" : "text-muted-foreground"}`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {activeCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[400px] p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Filters</span>
              {filters.length > 0 && (
                <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground">
                  Clear all
                </button>
              )}
            </div>
            {filters.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No filters applied</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={filter.column} onValueChange={(v) => updateFilter(index, { column: v })}>
                      <SelectTrigger className="h-7 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.name} value={col.name} className="text-xs">
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator}
                      onValueChange={(v) => updateFilter(index, { operator: v as FilterConfig["operator"] })}
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op.value} value={op.value} className="text-xs">
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filter.operator !== "is_null" && filter.operator !== "is_not_null" && (
                      <Input
                        value={filter.value}
                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                        placeholder="Value..."
                        className="h-7 flex-1 text-xs"
                      />
                    )}
                    <button onClick={() => removeFilter(index)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={addFilter} className="h-7 gap-1.5 self-start text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add filter
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
