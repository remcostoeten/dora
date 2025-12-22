"use client"

import { useState, useCallback, useEffect } from "react"
import { AppNav, type NavRoute } from "@/shared/components/app-nav"
import { TopBar } from "@/components/top-bar"
import { DbView } from "@/views/db-view"
import { QueriesView } from "@/views/queries-view"
import { SnippetsView } from "@/views/snippets-view"
import { SchemaView } from "@/views/schema-view"
import { SettingsView } from "@/views/settings-view"
import { useConn } from "@/store"

export default function Home() {
  const [activeRoute, setActiveRoute] = useState<NavRoute>("data")
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  // Get connection state from store
  const { connections, activeId } = useConn()
  const activeConnection = connections.find((c) => c.id === activeId)

  const connectionStatus = activeConnection
    ? "connected" as const
    : "disconnected" as const

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault()
            setActiveRoute("data")
            break
          case "2":
            e.preventDefault()
            setActiveRoute("queries")
            break
          case "3":
            e.preventDefault()
            setActiveRoute("snippets")
            break
          case "4":
            e.preventDefault()
            setActiveRoute("schema")
            break
          case ",":
            e.preventDefault()
            setActiveRoute("settings")
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleRouteChange = useCallback((route: NavRoute) => {
    setActiveRoute(route)
  }, [])

  const handleOpenInDataView = useCallback((tableName: string) => {
    setSelectedTable(tableName)
    setActiveRoute("data")
  }, [])

  const renderView = () => {
    switch (activeRoute) {
      case "data":
        return <DbView />
      case "queries":
        return <QueriesView />
      case "snippets":
        return <SnippetsView />
      case "schema":
        return <SchemaView isConnected={!!activeConnection} onOpenInDataView={handleOpenInDataView} />
      case "settings":
        return <SettingsView />
      default:
        return <DbView />
    }
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar
        connectionName={activeConnection?.name}
        databaseName={activeConnection?.database}
        status={connectionStatus}
        isDemo={activeConnection?.isDemo}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <AppNav activeRoute={activeRoute} onRouteChange={handleRouteChange} />
        <div className="flex-1 overflow-hidden">{renderView()}</div>
      </div>
    </main>
  )
}
