"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PageConfig } from "@/shared/types"

type Props = {
  config: PageConfig
  onChange: (config: PageConfig) => void
}

const pageSizes = [25, 50, 100, 250]

export function Pagination({ config, onChange }: Props) {
  const { page, pageSize, total } = config
  const totalPages = Math.ceil(total / pageSize)
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)

  const goToPage = (newPage: number) => {
    onChange({ ...config, page: Math.max(0, Math.min(newPage, totalPages - 1)) })
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onChange({ ...config, pageSize: Number(v), page: 0 })}>
          <SelectTrigger className="h-6 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          {start}-{end} of {total}
        </span>
        <Button variant="ghost" size="icon" onClick={() => goToPage(0)} disabled={page === 0} className="h-6 w-6">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToPage(page - 1)}
          disabled={page === 0}
          className="h-6 w-6"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages - 1}
          className="h-6 w-6"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToPage(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="h-6 w-6"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
