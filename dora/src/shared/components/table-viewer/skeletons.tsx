"use client"

import { memo } from "react"
import { cn } from "@/shared/utils"
import { Skeleton } from "@/components/ui/skeleton"

type RowHeight = "compact" | "normal" | "comfortable"

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

export const CellSkeleton = memo(function CellSkeleton({
  width,
  rowHeight = "normal",
  isPrimary = false,
}: {
  width?: number
  rowHeight?: RowHeight
  isPrimary?: boolean
}) {
  return (
    <td
      style={{ width, maxWidth: width }}
      className={cn(
        "border-r border-border/30 px-3",
        heightClasses[rowHeight],
        isPrimary && "w-20",
        !isPrimary && "min-w-[120px]",
      )}
    >
      <Skeleton className={cn("h-4", isPrimary ? "w-12" : "w-3/4")} />
    </td>
  )
})

export const RowNumberSkeleton = memo(function RowNumberSkeleton({
  rowHeight = "normal",
}: {
  rowHeight?: RowHeight
}) {
  return (
    <td className={cn("w-12 border-r border-border/30 bg-card/50 px-3 text-right", heightClasses[rowHeight])}>
      <Skeleton className="ml-auto h-3 w-6" />
    </td>
  )
})

export const RowSkeleton = memo(function RowSkeleton({
  columnCount,
  rowHeight = "normal",
}: {
  columnCount: number
  rowHeight?: RowHeight
}) {
  return (
    <tr className="border-b border-border/20">
      <RowNumberSkeleton rowHeight={rowHeight} />
      {Array.from({ length: columnCount }).map((_, i) => (
        <CellSkeleton key={i} rowHeight={rowHeight} isPrimary={i === 0} />
      ))}
    </tr>
  )
})

export const HeaderSkeleton = memo(function HeaderSkeleton({
  columnCount,
}: {
  columnCount: number
}) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-card">
        <th className="w-12 border-b border-r border-border/50 bg-card px-3 py-2.5 text-right font-normal text-muted-foreground/50">
          #
        </th>
        {Array.from({ length: columnCount }).map((_, i) => (
          <th
            key={i}
            className={cn(
              "border-b border-r border-border/50 bg-card px-3 py-2.5 text-left",
              i === 0 && "w-20",
              i !== 0 && "min-w-[120px]",
            )}
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </th>
        ))}
      </tr>
    </thead>
  )
})

export const TableViewerSkeleton = memo(function TableViewerSkeleton({
  columnCount = 5,
  rowCount = 10,
  rowHeight = "normal",
  showToolbar = true,
  showPagination = true,
  showStatusBar = true,
}: {
  columnCount?: number
  rowCount?: number
  rowHeight?: RowHeight
  showToolbar?: boolean
  showPagination?: boolean
  showStatusBar?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
          <Skeleton className="h-7 w-7" />
          <Skeleton className="h-7 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-7" />
        </div>
      )}

      {/* Table skeleton */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <HeaderSkeleton columnCount={columnCount} />
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <RowSkeleton key={i} columnCount={columnCount} rowHeight={rowHeight} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination skeleton */}
      {showPagination && (
        <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      )}

      {/* Status bar skeleton */}
      {showStatusBar && (
        <div className="flex items-center justify-between border-t border-border/30 bg-card/50 px-3 py-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      )}
    </div>
  )
})

export const CellLoadingOverlay = memo(function CellLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary/50" />
    </div>
  )
})
