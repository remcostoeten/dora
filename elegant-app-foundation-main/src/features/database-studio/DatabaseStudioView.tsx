import { useCallback } from "react";
import { toast } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { DataGrid } from "./components/DataGrid";
import { useTableState } from "./hooks/use-table-state";
import type { TableInfo } from "./types";

export function DatabaseStudioView() {
  const {
    tables,
    selectedTable,
    searchQuery,
    showTables,
    showViews,
    columns,
    displayColumns,
    rows,
    filters,
    sortConfig,
    selectedRows,
    visibleColumns,
    hasDrafts,
    draftCount,
    setSearchQuery,
    setShowTables,
    setShowViews,
    handleSelectTable,
    handleToggleColumn,
    handleToggleAllColumns,
    handleAddFilter,
    handleRemoveFilter,
    handleUpdateFilter,
    handleSort,
    handleRowClick,
    handleToggleRow,
    handleSelectAllRows,
    handleCellClick,
    handleCellDoubleClick,
    handleFinishCellEdit,
    handleFinishAllEditing,
    isCellEditing,
    isCellSelected,
    handleCellEdit,
    handleDiscardAllDrafts,
    getDraftValue,
    handleAddRecord,
    handleColumnResize,
    handleColumnDoubleClickResize,
    getColumnWidth,
  } = useTableState();

  const handleRefresh = useCallback(() => {
    toast.success("Refreshed");
  }, []);

  const handleAddTable = useCallback(() => {
    toast.info("Add table dialog would open");
  }, []);

  const handleBrowseData = useCallback((table: TableInfo) => {
    handleSelectTable(table);
    toast.info(`Browsing ${table.name}`);
  }, [handleSelectTable]);

  const handleAlterTable = useCallback((table: TableInfo) => {
    toast.info(`Alter table: ${table.name}`);
  }, []);

  const handleTruncateTable = useCallback((table: TableInfo) => {
    toast.warning(`Would truncate: ${table.name}`);
  }, []);

  const handleDropTable = useCallback((table: TableInfo) => {
    toast.error(`Would drop: ${table.name}`);
  }, []);

  const handlePrevPage = useCallback(() => {
    toast.info("Previous page");
  }, []);

  const handleNextPage = useCallback(() => {
    toast.info("Next page");
  }, []);

  const handleSaveDrafts = useCallback(() => {
    handleFinishAllEditing();
    toast.success("Drafts saved (mock)");
  }, [handleFinishAllEditing]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        tables={tables}
        selectedTable={selectedTable}
        searchQuery={searchQuery}
        showTables={showTables}
        showViews={showViews}
        onSearchChange={setSearchQuery}
        onToggleTables={setShowTables}
        onToggleViews={setShowViews}
        onSelectTable={handleSelectTable}
        onRefresh={handleRefresh}
        onAddTable={handleAddTable}
        onBrowseData={handleBrowseData}
        onAlterTable={handleAlterTable}
        onTruncateTable={handleTruncateTable}
        onDropTable={handleDropTable}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {selectedTable ? (
          <>
            <Toolbar
              tableName={selectedTable.name}
              columns={columns}
              visibleColumns={visibleColumns}
              filters={filters}
              rowCount={rows.length}
              currentOffset={0}
              limit={50}
              queryTime="26ms"
              hasDrafts={hasDrafts}
              draftCount={draftCount}
              onToggleColumn={handleToggleColumn}
              onToggleAllColumns={handleToggleAllColumns}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
              onUpdateFilter={handleUpdateFilter}
              onAddRecord={handleAddRecord}
              onRefresh={handleRefresh}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onSaveDrafts={handleSaveDrafts}
              onDiscardDrafts={handleDiscardAllDrafts}
            />
            <DataGrid
              columns={displayColumns}
              rows={rows}
              selectedRows={selectedRows}
              sortConfig={sortConfig}
              onSort={handleSort}
              onRowClick={handleRowClick}
              onToggleRow={handleToggleRow}
              onSelectAllRows={handleSelectAllRows}
              onCellClick={handleCellClick}
              onCellDoubleClick={handleCellDoubleClick}
              onFinishCellEdit={handleFinishCellEdit}
              isCellEditing={isCellEditing}
              isCellSelected={isCellSelected}
              onCellEdit={handleCellEdit}
              getDraftValue={getDraftValue}
              onColumnResize={handleColumnResize}
              onColumnDoubleClickResize={handleColumnDoubleClickResize}
              getColumnWidth={getColumnWidth}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Select a table to view data</p>
          </div>
        )}
      </main>
    </div>
  );
}
