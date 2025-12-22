"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Database } from "lucide-react"
import { TabBar } from "@/shared/components/tab-bar"
import { TableViewer } from "@/shared/components/table-viewer"
import { InfoPanel } from "@/shared/components/info-panel"
import { QueryPanel } from "@/shared/components/query-panel"
import { Sidebar } from "@/shared/components/sidebar"
import { ConnForm } from "@/shared/components/sidebar/conn-form"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { SidebarSkeleton } from "@/shared/components/sidebar/sidebar-skeleton"
import { EmptyState } from "@/shared/components/empty-state"
import { useTabs, useCells, useConn, useQuery, useTableView } from "@/store"
import { useRowSelection } from "@/store/row-selection"
import { useResize } from "@/shared/hooks"
import type { DbConnection, PageConfig } from "@/shared/types"

export function DbView() {
  const { tabs, activeId, addTab, closeTab, setActive, reorderTabs, closeAll, closeLeft, closeRight } = useTabs()
  const { selected, changes, setSelected, updateCell, applyChanges, discardChanges } = useCells()
  const {
    connections,
    activeId: activeConnId,
    tables,
    selectedTable,
    tableSchemas,
    isLoading: isConnLoading,
    setActive: setActiveConn,
    selectTable,
    addConnection,
    editConnection,
    deleteConnection,
    refreshTables,
  } = useConn()
  const { visible, maximized, setVisible } = useQuery()
  const {
    sort,
    filters,
    page,
    columns,
    data,
    totalRows,
    isLoading: isTableLoading,
    setSort,
    setFilters,
    loadTableData,
    loadSpecificPage,
    lastQuery,
  } = useTableView()

  const { selectedRows, selectRow, toggleRow, selectRange, clearSelection } = useRowSelection()

  const [connFormOpen, setConnFormOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<DbConnection | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true)

  const {
    size: infoPanelWidth,
    isDragging,
    handleStart,
  } = useResize({
    min: 240,
    max: 600,
    initial: 320,
  })

  const activeTab = tabs.find((t) => t.id === activeId)
  const tableSchema = selectedTable ? tableSchemas[selectedTable] || null : null
  const activeConnection = connections.find((c) => c.id === activeConnId)

  const hasNoConnection = !activeConnId
  const hasNoTabs = tabs.length === 0

  useEffect(() => {
    // Only load data if we have an active connection and a table tab
    if (activeConnId && activeTab && activeTab.type === "table") {
      loadTableData(activeTab.name)
    }
  }, [activeTab, activeConnId])

  const handleTableOpen = useCallback(
    (tableName: string) => {
      const existingTab = tabs.find((t) => t.name === tableName && t.type === "table")
      if (existingTab) {
        setActive(existingTab.id)
      } else {
        addTab("table", tableName)
      }
    },
    [tabs, setActive, addTab],
  )

  const handleAddTab = useCallback(
    (type: "table" | "query") => {
      addTab(type)
      if (type === "query") {
        setVisible(true)
      }
    },
    [addTab, setVisible],
  )

  const handleAddConn = useCallback(() => {
    setEditingConn(null)
    setConnFormOpen(true)
  }, [])

  const handleEditConn = useCallback(
    (id: string) => {
      const conn = connections.find((c) => c.id === id)
      if (conn) {
        setEditingConn(conn)
        setConnFormOpen(true)
      }
    },
    [connections],
  )

  const handleDeleteConn = useCallback(
    (id: string) => {
      deleteConnection(id)
    },
    [deleteConnection],
  )

  const handleConnFormSubmit = useCallback(
    (data: any) => {
      if (data.id) {
        editConnection(data.id, data)
      } else {
        addConnection(data)
      }
    },
    [editConnection, addConnection],
  )

  const handleDeleteRows = useCallback(
    async (rowIndices: number[]) => {
      const pkColumn = columns.find((c) => c.isPrimary)
      if (!pkColumn) {
        console.error("No primary key column found")
        return
      }

      const primaryKeys = rowIndices.map((idx) => {
        const row = data[idx]
        return { [pkColumn.name]: row[pkColumn.name] }
      })

      const newData = data.filter((_, idx) => !rowIndices.includes(idx))
      clearSelection()
    },
    [columns, data, clearSelection],
  )

  const handlePaginationChange = useCallback(
    (config: PageConfig) => {
      if (!activeTab || activeTab.type !== "table") return

      if (config.pageSize !== page.pageSize) {
        loadTableData(activeTab.name, 0, config.pageSize)
      } else if (config.page !== page.page) {
        loadSpecificPage(activeTab.name, config.page)
      }
    },
    [activeTab, page, loadTableData, loadSpecificPage],
  )

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev)
  }, [])

  const handleToggleRightSidebar = useCallback(() => {
    setRightSidebarVisible((prev) => !prev)
  }, [])

  const tableViewerProps = useMemo(
    () => ({
      columns,
      data,
      selectedCell: selected,
      onCellSelect: setSelected,
      selectedRows,
      onRowSelect: selectRow,
      onRowToggle: toggleRow,
      onRowRangeSelect: selectRange,
      onClearRowSelection: clearSelection,
      onDeleteRows: handleDeleteRows,
      pendingChanges: changes,
      onCellChange: updateCell,
      onApplyChanges: applyChanges,
      onDiscardChanges: discardChanges,
      enableSorting: true,
      sortConfig: sort,
      onSortChange: setSort,
      enableFiltering: true,
      filters,
      onFiltersChange: setFilters,
      tableName: activeTab?.name,
      sidebarVisible,
      onToggleSidebar: handleToggleSidebar,
      rightSidebarVisible,
      onToggleRightSidebar: handleToggleRightSidebar,
      enablePagination: true,
      pagination: page,
      onPaginationChange: handlePaginationChange,
      rowHeight: "normal" as const,
      totalRows,
      isLoading: isTableLoading,
      lastQuery,
    }),
    [
      columns,
      data,
      selected,
      setSelected,
      selectedRows,
      selectRow,
      toggleRow,
      selectRange,
      clearSelection,
      handleDeleteRows,
      changes,
      updateCell,
      applyChanges,
      discardChanges,
      sort,
      setSort,
      filters,
      setFilters,
      activeTab?.name,
      sidebarVisible,
      handleToggleSidebar,
      rightSidebarVisible,
      handleToggleRightSidebar,
      page,
      handlePaginationChange,
      totalRows,
      isTableLoading,
    ],
  )

  return (
    <>
      <div className="flex h-full bg-background">
        {sidebarVisible &&
          (isConnLoading && connections.length === 0 ? (
            <SidebarSkeleton />
          ) : (
            <Sidebar
              connections={connections}
              activeId={activeConnId}
              onSetActive={setActiveConn}
              onAddConn={handleAddConn}
              onEditConn={handleEditConn}
              onDeleteConn={handleDeleteConn}
              tables={tables}
              selectedTable={selectedTable}
              onSelectTable={selectTable}
              onTableOpen={handleTableOpen}
              onRefresh={refreshTables}
              tableSchema={tableSchema}
            />
          ))}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!hasNoTabs && (
            <TabBar
              tabs={tabs}
              activeId={activeId}
              onClick={setActive}
              onClose={closeTab}
              onAddTab={handleAddTab}
              onReorderTabs={reorderTabs}
              onCloseAll={closeAll}
              onCloseLeft={closeLeft}
              onCloseRight={closeRight}
            />
          )}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              {hasNoConnection ? (
                <EmptyState
                  icon={Database}
                  title="Not Connected"
                  desc={`Select a connection from the sidebar to get started.${activeConnection?.isDemo ? " You are viewing demo data." : ""}`}
                />
              ) : hasNoTabs ? (
                <EmptyState
                  icon={Database}
                  title="No tabs open"
                  desc={`Connected to ${activeConnection?.name ?? "database"}. Open a table from the sidebar to browse data.`}
                  act={{
                    label: "New Query",
                    onPress: () => handleAddTab("query"),
                  }}
                />
              ) : visible && activeTab?.type === "query" ? (
                maximized ? (
                  <QueryPanel onClose={() => setVisible(false)} />
                ) : (
                  <ResizablePanelGroup direction="vertical">
                    <ResizablePanel defaultSize={35} minSize={20} maxSize={80}>
                      <QueryPanel onClose={() => setVisible(false)} />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={65} minSize={20}>
                      <TableViewer {...tableViewerProps} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )
              ) : (
                <TableViewer {...tableViewerProps} />
              )}
            </div>
            {selected && rightSidebarVisible && !hasNoTabs && (
              <div className="relative flex" style={{ width: infoPanelWidth }}>
                <div
                  onMouseDown={handleStart}
                  className={`absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 ${isDragging ? "bg-primary/30" : ""}`}
                />
                <InfoPanel
                  cell={selected}
                  pendingChanges={changes}
                  onClose={() => setSelected(null)}
                  onCellChange={updateCell}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ConnForm
        open={connFormOpen}
        onOpenChange={setConnFormOpen}
        connection={editingConn}
        onSubmit={handleConnFormSubmit}
      />
    </>
  )
}
