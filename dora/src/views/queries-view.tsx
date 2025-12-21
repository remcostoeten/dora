"use client"

import { Code2 } from "lucide-react"
import { EmptyState } from "@/shared/components/empty-state"

export function QueriesView() {
  return (
    <div className="flex h-full w-full bg-background">
      <EmptyState
        icon={Code2}
        title="Query Editor"
        desc="Write and execute SQL queries against your database. Save frequently used queries for quick access."
        act={{
          label: "New Query",
          onPress: () => {
            // TODO: Tauri invoke - create_new_query
            console.log("Create new query")
          },
        }}
        act2={{
          label: "Open Recent",
          onPress: () => {
            // TODO: Tauri invoke - open_recent_queries
            console.log("Open recent queries")
          },
        }}
      />
    </div>
  )
}
