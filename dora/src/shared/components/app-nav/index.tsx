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
        className="flex h-full w-[52px] flex-col items-center border-r border-border bg-sidebar/90 backdrop-blur-xl py-4"
      >
        <div className="mb-6 flex h-8 w-8 items-center justify-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary shadow-sm"
            aria-label="Application logo"
          >
            <Database className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2} />
          </div>
        </div>

        {/* Separator */}
        <div className="mb-2 h-px w-6 bg-border" aria-hidden="true" />

        {/* Main nav items */}
        <div className="flex flex-1 flex-col items-center gap-2" role="list">
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
            "group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
            isActive
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-[18px] w-[18px] transition-transform duration-200",
              "group-hover:scale-110",
              isActive && "scale-105",
            )}
            strokeWidth={isActive ? 2 : 1.75}
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
