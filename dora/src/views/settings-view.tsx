"use client"

import { Settings } from "lucide-react"
import { EmptyState } from "@/shared/components/empty-state"

export function SettingsView() {
  return (
    <div className="flex h-full w-full bg-background">
      <EmptyState
        icon={Settings}
        title="Settings"
        desc="Configure application preferences, connection defaults, keyboard shortcuts, and appearance options."
        act={{
          label: "Open Preferences",
          onPress: () => {
            // TODO: Tauri invoke - open_preferences
            console.log("Open preferences")
          },
        }}
      />
    </div>
  )
}
