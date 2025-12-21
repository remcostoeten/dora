"use client"

import { memo } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const ConnStatusSkeleton = memo(function ConnStatusSkeleton() {
  return (
    <div className="flex flex-col gap-2 border-b border-sidebar-border p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  )
})

export const TableItemSkeleton = memo(function TableItemSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Skeleton className="h-3.5 w-3.5 shrink-0" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-8" />
    </div>
  )
})

export const TableListSkeleton = memo(function TableListSkeleton({
  tableCount = 8,
}: {
  tableCount?: number
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 border-b border-sidebar-border px-3 py-2">
        <Skeleton className="h-7 flex-1" />
        <Skeleton className="h-7 w-7" />
      </div>

      {/* Schema header */}
      <div className="flex items-center gap-1 px-3 py-1">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-12" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-4" />
      </div>

      {/* Table items */}
      <div className="flex-1 overflow-y-auto py-1">
        {Array.from({ length: tableCount }).map((_, i) => (
          <TableItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
})

export const TableSchemaSkeleton = memo(function TableSchemaSkeleton({
  columnCount = 5,
}: {
  columnCount?: number
}) {
  return (
    <div className="border-t border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-3 w-3" />
      </div>

      {/* Column list */}
      <div className="max-h-48 overflow-y-auto px-3 pb-2">
        {Array.from({ length: columnCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-24" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
})

export const SidebarSkeleton = memo(function SidebarSkeleton({
  width = 240,
  tableCount = 8,
}: {
  width?: number
  tableCount?: number
}) {
  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar" style={{ width }}>
      <ConnStatusSkeleton />
      <TableListSkeleton tableCount={tableCount} />
      <TableSchemaSkeleton />
    </div>
  )
})
