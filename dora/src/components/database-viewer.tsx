"use client"

import { useState, useCallback } from "react"
import { TabBar } from "@/shared/components/tab-bar"
import {
  TableViewer,
  type CellInfo,
  type CellChange,
  type SortConfig,
  type FilterConfig,
  type PaginationConfig,
  type Column,
} from "./table-viewer"
import { InfoPanel } from "./info-panel"
import { QueryPanel } from "./query-panel"
import { Sidebar, type DatabaseConnection, type TableInfo, type TableSchema } from "./sidebar"

export type { CellInfo, CellChange }

export interface TableTab {
  id: string
  name: string
  type: "table" | "query"
}

const initialTabs: TableTab[] = [
  { id: "1", name: "users", type: "table" },
  { id: "2", name: "orders", type: "table" },
]

const mockConnections: DatabaseConnection[] = [
  {
    id: "1",
    name: "Production",
    type: "postgresql",
    host: "db.example.com",
    database: "app_production",
    status: "connected",
  },
  {
    id: "2",
    name: "Local Dev",
    type: "sqlite",
    database: "dev.db",
    status: "disconnected",
  },
  {
    id: "3",
    name: "Staging",
    type: "libsql",
    database: "staging-db.turso.io",
    status: "disconnected",
  },
]

const mockTables: TableInfo[] = [
  { name: "users", schema: "public", rowCount: 1284, type: "table" },
  { name: "orders", schema: "public", rowCount: 8472, type: "table" },
  { name: "products", schema: "public", rowCount: 156, type: "table" },
  { name: "categories", schema: "public", rowCount: 12, type: "table" },
  { name: "order_items", schema: "public", rowCount: 24891, type: "table" },
  { name: "user_sessions", schema: "auth", rowCount: 3421, type: "table" },
  { name: "active_users", schema: "public", type: "view" },
  { name: "order_summary", schema: "public", type: "view" },
]

const mockSchemas: Record<string, TableSchema> = {
  users: {
    name: "users",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "email", type: "varchar(255)" },
      { name: "name", type: "varchar(100)", isNullable: true },
      { name: "status", type: "varchar(20)" },
      { name: "created_at", type: "timestamptz" },
      { name: "is_active", type: "bool" },
      { name: "role", type: "varchar(50)" },
    ],
    indexes: [
      { name: "users_pkey", columns: ["id"], isUnique: true },
      { name: "users_email_idx", columns: ["email"], isUnique: true },
    ],
  },
  orders: {
    name: "orders",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "user_id", type: "int4", isForeignKey: true, references: { table: "users", column: "id" } },
      { name: "total", type: "numeric(10,2)" },
      { name: "status", type: "varchar(20)" },
      { name: "created_at", type: "timestamptz" },
    ],
    indexes: [
      { name: "orders_pkey", columns: ["id"], isUnique: true },
      { name: "orders_user_id_idx", columns: ["user_id"], isUnique: false },
    ],
  },
}

const mockColumns: Column[] = [
  { name: "id", type: "int4", isPrimary: true },
  { name: "email", type: "varchar" },
  { name: "name", type: "varchar", isNullable: true },
  { name: "status", type: "varchar" },
  { name: "created_at", type: "timestamptz" },
  { name: "is_active", type: "bool" },
  { name: "role", type: "varchar" },
]

const mockData = [
  {
    id: 1,
    email: "john@example.com",
    name: "John Doe",
    status: "active",
    created_at: "2024-01-15T09:30:00Z",
    is_active: true,
    role: "admin",
  },
  {
    id: 2,
    email: "jane@example.com",
    name: "Jane Smith",
    status: "active",
    created_at: "2024-01-16T14:22:00Z",
    is_active: true,
    role: "user",
  },
  {
    id: 3,
    email: "bob@example.com",
    name: "Bob Wilson",
    status: "pending",
    created_at: "2024-01-17T11:45:00Z",
    is_active: false,
    role: "user",
  },
  {
    id: 4,
    email: "alice@example.com",
    name: null,
    status: "inactive",
    created_at: "2024-01-18T08:15:00Z",
    is_active: false,
    role: "viewer",
  },
  {
    id: 5,
    email: "charlie@example.com",
    name: "Charlie Brown",
    status: "active",
    created_at: "2024-01-19T16:00:00Z",
    is_active: true,
    role: "user",
  },
  {
    id: 6,
    email: "diana@example.com",
    name: "Diana Prince",
    status: "active",
    created_at: "2024-01-20T10:30:00Z",
    is_active: true,
    role: "admin",
  },
  {
    id: 7,
    email: "evan@example.com",
    name: null,
    status: "pending",
    created_at: "2024-01-21T13:45:00Z",
    is_active: false,
    role: "user",
  },
  {
    id: 8,
    email: "fiona@example.com",
    name: "Fiona Green",
    status: "active",
    created_at: "2024-01-22T08:00:00Z",
    is_active: true,
    role: "user",
  },
  {
    id: 9,
    email: "george@example.com",
    name: "George Miller",
    status: "inactive",
    created_at: "2024-01-23T12:30:00Z",
    is_active: false,
    role: "viewer",
  },
  {
    id: 10,
    email: "hannah@example.com",
    name: "Hannah White",
    status: "active",
    created_at: "2024-01-24T15:45:00Z",
    is_active: true,
    role: "admin",
  },
]

export function DatabaseViewer() {
  const [tabs, setTabs] = useState<TableTab[]>(initialTabs)
  const [activeTabId, setActiveTabId] = useState("1")
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)
  const [showQueryPanel, setShowQueryPanel] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<string, CellChange>>(new Map())

  const [activeConnectionId, setActiveConnectionId] = useState<string>("1")
  const [selectedTable, setSelectedTable] = useState<string | null>("users")

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [filters, setFilters] = useState<FilterConfig[]>([])
  const [pagination, setPagination] = useState<PaginationConfig>({ page: 0, pageSize: 50, total: mockData.length })

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const handleAddTab = (type: "table" | "query") => {
    const newTab: TableTab = {
      id: Date.now().toString(),
      name: type === "query" ? "New Query" : "new_table",
      type,
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
    if (type === "query") {
      setShowQueryPanel(true)
    }
  }

  const handleTableOpen = (tableName: string) => {
    const existingTab = tabs.find((t) => t.name === tableName && t.type === "table")
    if (existingTab) {
      setActiveTabId(existingTab.id)
    } else {
      const newTab: TableTab = {
        id: Date.now().toString(),
        name: tableName,
        type: "table",
      }
      setTabs([...tabs, newTab])
      setActiveTabId(newTab.id)
    }
  }

  const handleCloseTab = (id: string) => {
    const closingIndex = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.filter((t) => t.id !== id)

    if (newTabs.length === 0) {
      handleAddTab("table")
      return
    }

    if (activeTabId === id) {
      const nextTab = newTabs[Math.min(closingIndex, newTabs.length - 1)]
      setActiveTabId(nextTab.id)
    }

    setTabs(newTabs)
  }

  const handleCellChange = useCallback(
    (rowIndex: number, columnName: string, originalValue: string, newValue: string) => {
      const key = `${rowIndex}:${columnName}`
      setPendingChanges((prev) => {
        const next = new Map(prev)
        if (newValue === originalValue) {
          next.delete(key)
        } else {
          next.set(key, { rowIndex, columnName, originalValue, newValue })
        }
        return next
      })
    },
    [],
  )

  const handleApplyChanges = useCallback(() => {
    console.log("Applying changes:", Array.from(pendingChanges.values()))
    setPendingChanges(new Map())
  }, [pendingChanges])

  const handleDiscardChanges = useCallback(() => {
    setPendingChanges(new Map())
  }, [])

  return (
    <div className="flex h-full bg-background">
      <Sidebar
        connections={mockConnections}
        activeConnectionId={activeConnectionId}
        onConnectionChange={setActiveConnectionId}
        onAddConnection={() => console.log("Add connection")}
        tables={mockTables}
        selectedTable={selectedTable}
        onTableSelect={setSelectedTable}
        onTableOpen={handleTableOpen}
        onRefreshTables={() => console.log("Refresh tables")}
        tableSchema={selectedTable ? mockSchemas[selectedTable] || null : null}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar
          tabs={tabs}
          activeId={activeTabId}
          onClick={setActiveTabId}
          onClose={handleCloseTab}
          onAddTab={handleAddTab}
        />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            {showQueryPanel && activeTab?.type === "query" && <QueryPanel onClose={() => setShowQueryPanel(false)} />}
            <TableViewer
              columns={mockColumns}
              data={mockData}
              selectedCell={selectedCell}
              onCellSelect={setSelectedCell}
              pendingChanges={pendingChanges}
              onCellChange={handleCellChange}
              onApplyChanges={handleApplyChanges}
              onDiscardChanges={handleDiscardChanges}
              enableSorting
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
              enableFiltering
              filters={filters}
              onFiltersChange={setFilters}
              enablePagination
              pagination={pagination}
              onPaginationChange={setPagination}
              rowHeight="normal"
            />
          </div>
          {selectedCell && (
            <InfoPanel
              cell={selectedCell}
              pendingChanges={pendingChanges}
              onClose={() => setSelectedCell(null)}
              onCellChange={handleCellChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
