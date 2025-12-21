"use client"

import { useState, useCallback, useEffect } from "react"
import { AppNav, type NavRoute } from "@/shared/components/app-nav"
import { TopBar } from "@/components/top-bar"
import { DbView } from "@/views/db-view"
import { QueriesView } from "@/views/queries-view"
import { SnippetsView } from "@/views/snippets-view"
import { SchemaView } from "@/views/schema-view"
import { SettingsView } from "@/views/settings-view"

export default function Home() {
  const [activeRoute, setActiveRoute] = useState<NavRoute>("data")
  const [isConnected, setIsConnected] = useState(true)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  const [connectionInfo, setConnectionInfo] = useState({
    name: "Local Database",
    database: "my_app.db",
    status: "connected" as const,
  })

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
        return <SchemaView isConnected={isConnected} onOpenInDataView={handleOpenInDataView} />
      case "settings":
        return <SettingsView />
      default:
        return <DbView />
    }
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar
        connectionName={connectionInfo.name}
        databaseName={connectionInfo.database}
        status={connectionInfo.status}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <AppNav activeRoute={activeRoute} onRouteChange={handleRouteChange} />
        <div className="flex-1 overflow-hidden">{renderView()}</div>
      </div>
    </main>
  )
}
