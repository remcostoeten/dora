"use client"

import { Library } from "lucide-react"
import { EmptyState } from "@/shared/components/empty-state"

export function SnippetsView() {
  return (
    <div className="flex h-full w-full bg-background">
      <EmptyState
        icon={Library}
        title="Snippets Library"
        desc="Store and organize reusable SQL snippets, templates, and code fragments for quick insertion."
        act={{
          label: "Create Snippet",
          onPress: () => {
            // TODO: Tauri invoke - create_snippet
            console.log("Create snippet")
          },
        }}
        act2={{
          label: "Import Snippets",
          onPress: () => {
            // TODO: Tauri invoke - import_snippets
            console.log("Import snippets")
          },
        }}
      />
    </div>
  )
}
