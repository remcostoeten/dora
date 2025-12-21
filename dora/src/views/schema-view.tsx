"use client"

import { SchemaVisualizer } from "@/features/schema-visualizer"

type SchemaViewProps = {
  isConnected?: boolean
  onOpenInDataView?: (tableName: string) => void
}

export function SchemaView({ isConnected, onOpenInDataView }: SchemaViewProps) {
  return (
    <div className="flex h-full w-full bg-background">
      <SchemaVisualizer isConnected={isConnected} onOpenInDataView={onOpenInDataView} />
    </div>
  )
}
