"use client"

import type React from "react"

import { useCallback } from "react"
import { Database, Code2, Library, GitBranch, Settings, type LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type NavRoute = "data" | "queries" | "snippets" | "schema" | "settings"

interface NavItem {
  id: NavRoute
  label: string
  icon: LucideIcon
  shortcut?: string
}

const navItems: NavItem[] = [
  { id: "data", label: "Data Browser", icon: Database, shortcut: "Ctrl+1" },
  { id: "queries", label: "Query Editor", icon: Code2, shortcut: "Ctrl+2" },
  { id: "snippets", label: "Snippets Library", icon: Library, shortcut: "Ctrl+3" },
  { id: "schema", label: "Schema Visualizer", icon: GitBranch, shortcut: "Ctrl+4" },
]

const settingsItem: NavItem = {
  id: "settings",
  label: "Settings",
  icon: Settings,
  shortcut: "Ctrl+,",
}

interface AppNavProps {
  activeRoute: NavRoute
  onRouteChange: (route: NavRoute) => void
}

export function AppNav({ activeRoute, onRouteChange }: AppNavProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, route: NavRoute) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onRouteChange(route)
      }
    },
    [onRouteChange],
  )

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex h-full w-14 flex-col items-center border-r border-border bg-background py-6"
      >
        <div className="mb-8 flex h-9 w-9 items-center justify-center">
          <div
            className="flex h-9 w-9 items-center justify-center bg-primary/20"
            aria-label="Application logo"
          >
            <Database className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </div>
        </div>

        {/* Separator */}
        <div className="mb-4 h-px w-8 bg-border" aria-hidden="true" />

        {/* Main nav items */}
        <div className="flex flex-1 flex-col items-center gap-4" role="list">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeRoute === item.id}
              onClick={() => onRouteChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
            />
          ))}
        </div>

        {/* Settings at bottom */}
        <div className="mt-auto" role="list">
          <NavButton
            item={settingsItem}
            isActive={activeRoute === "settings"}
            onClick={() => onRouteChange("settings")}
            onKeyDown={(e) => handleKeyDown(e, "settings")}
          />
        </div>
      </nav>
    </TooltipProvider>
  )
}

interface NavButtonProps {
  item: NavItem
  isActive: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

function NavButton({ item, isActive, onClick, onKeyDown }: NavButtonProps) {
  const Icon = item.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="listitem"
          aria-label={item.label}
          aria-current={isActive ? "page" : undefined}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className={cn(
            "group relative flex h-10 w-10 items-center justify-center transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            isActive
              ? "bg-accent/30 text-foreground"
              : "text-muted-foreground hover:bg-accent/20 hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5 transition-transform duration-150",
              "group-hover:scale-105",
            )}
            strokeWidth={isActive ? 1.75 : 1.5}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <div className="flex items-center gap-2">
          <span>{item.label}</span>
          {item.shortcut && (
            <kbd className="rounded bg-background/20 px-1.5 py-0.5 font-mono text-[10px]">{item.shortcut}</kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
