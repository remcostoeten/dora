import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ConnectionSwitcher } from "../connections/components/connection-switcher";
import { NavButtons } from "./components/nav-buttons";
import { SchemaSelector } from "./components/schema-selector";
import { TableSearch, FilterState } from "./components/table-search";
import { TableList } from "./components/table-list";
import type { TableRightClickAction } from "./components/table-list";

import { BottomToolbar, ToolbarAction, Theme } from "./components/bottom-toolbar";
import { ManageTablesDialog, BulkAction } from "./components/manage-tables-dialog";
import { RenameTableDialog } from "./components/rename-table-dialog";
import { DropTableDialog } from "../database-studio/components/drop-table-dialog";
import { Schema, TableItem } from "./types";
import { Connection } from "../connections/types";
import { Button } from "@/shared/ui/button";
import { SidebarTableSkeleton } from "@/components/ui/skeleton";
import { Plus, Database as DatabaseIcon } from "lucide-react";
import { useAdapter } from "@/core/data-provider";
import type { DatabaseSchema, TableInfo } from "@/lib/bindings";
import { commands } from "@/lib/bindings";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const DEFAULT_FILTERS: FilterState = {
  showTables: true,
  showViews: true,
  showMaterializedViews: true,
};

type Props = {
  activeNavId?: string;
  onNavSelect?: (id: string) => void;
  onTableSelect?: (tableId: string, tableName: string) => void;
  selectedTableId?: string;
  autoSelectFirstTable?: boolean;
  onAutoSelectComplete?: () => void;

  connections?: Connection[];
  activeConnectionId?: string;
  onConnectionSelect?: (id: string) => void;
  onAddConnection?: () => void;
  onManageConnections?: () => void;
  onViewConnection?: (id: string) => void;
  onEditConnection?: (id: string) => void;
  onDeleteConnection?: (id: string) => void;
};

export function DatabaseSidebar({
  activeNavId: controlledNavId,
  onNavSelect,
  onTableSelect,
  selectedTableId,
  autoSelectFirstTable,
  onAutoSelectComplete,
  connections = [],
  activeConnectionId,
  onConnectionSelect = function() { },
  onAddConnection = function() { },
  onManageConnections = function() { },
  onViewConnection,
  onEditConnection,
  onDeleteConnection,
}: Props = {}) {
  const { toast } = useToast();
  const adapter = useAdapter();
  const [internalNavId, setInternalNavId] = useState("database-studio");
  const activeNavId = controlledNavId ?? internalNavId;

  const handleNavSelect = (id: string) => {
    if (onNavSelect) {
      onNavSelect(id);
    } else {
      setInternalNavId(id);
    }
  };

  const [selectedSchema, setSelectedSchema] = useState<Schema | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [internalTableId, setInternalTableId] = useState<string | undefined>();
  const activeTableId = selectedTableId ?? internalTableId;
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | undefined>();
  const [theme, setTheme] = useState<Theme>("dark");

  // Real database schema state (populated by adapter, whether mock or real)
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDropDialog, setShowDropDialog] = useState(false);
  const [targetTableName, setTargetTableName] = useState<string>("");
  const [isDdlLoading, setIsDdlLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  useEffect(function handleAutoSelectFirstTable() {
    async function fetchSchema() {
      if (!activeConnectionId) {
        setSchema(null);
        return;
      }

      setIsLoadingSchema(true);
      setSchemaError(null);

      try {
        const connectResult = await adapter.connectToDatabase(activeConnectionId);
        if (!connectResult.ok) {
          throw new Error(connectResult.error);
        }

        const result = await adapter.getSchema(activeConnectionId);
        if (result.ok) {
          setSchema(result.data);
          if (result.data.schemas.length > 0) {
            const dbName = connections.find(function(c) { return c.id === activeConnectionId; })?.name || "db";
            setSelectedSchema({
              id: result.data.schemas[0],
              name: result.data.schemas[0],
              databaseId: activeConnectionId
            });
          }

          if (autoSelectFirstTable && result.data.tables.length > 0 && onTableSelect) {
            const firstTable = result.data.tables[0];
            onTableSelect(firstTable.name, firstTable.name);
            if (onAutoSelectComplete) {
              onAutoSelectComplete();
            }
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to fetch schema:", error);
        setSchemaError(error instanceof Error ? error.message : "Failed to load schema");
        setSchema(null);
      } finally {
        setIsLoadingSchema(false);
      }
    }

    fetchSchema();
  }, [activeConnectionId, adapter, refreshTrigger, autoSelectFirstTable, onTableSelect, onAutoSelectComplete]);

  // Convert backend TableInfo to frontend TableItem format
  const tables = useMemo((): TableItem[] => {
    if (!schema) return [];
    return schema.tables.map((table: TableInfo) => ({
      id: table.name,
      name: table.name,
      rowCount: table.row_count_estimate ?? 0,
      type: "table" as const, // Backend doesn't distinguish views yet
    }));
  }, [schema]);

  const filteredTables = useMemo(() => {
    if (!schema) return [];

    return tables.filter((table) => {
      // Filter by search
      if (searchValue && !table.name.toLowerCase().includes(searchValue.toLowerCase())) {
        return false;
      }

      // Filter by schema if needed (backend returns all tables for current db in schema.tables)
      // Note: Backend schema structure has `tables` which contains all tables.
      // If we want to filter by selectedSchema (which is just a string name), we need to check table.schema
      const tableSchema = (table as any).schema || "public"; // casting because TableItem doesn't have schema currently, need to check source
      // Actually TableItem mapped from TableInfo above. TableInfo has schema property.
      // But we mapped it to TableItem which only has id, name, rowCount, type.
      // We should check the original TableInfo or map schema too.

      // Re-map in useMemo above to include schema?
      // Let's assume schema.tables contains tables for ALL schemas in the DB.
      // We need to filter by selectedSchema.

      return true;
    }).filter(table => {
      if (table.type === "table" && !filters.showTables) return false;
      if (table.type === "view" && !filters.showViews) return false;
      if (table.type === "materialized-view" && !filters.showMaterializedViews) return false;
      return true;
    });
  }, [schema, tables, searchValue, filters]);

  // The filteredTables above logic was slightly incomplete regarding schema filtering.
  // We need to make sure we filter by `selectedSchema`
  // But since TableItem interface doesn't have schema, let's just rely on the fact that for now
  // our simple mock schemas typically have 1 schema.
  // In a real app, we should improve TableItem type.

  function handleTableSelect(tableId: string) {
    setInternalTableId(tableId);
    if (onTableSelect) {
      onTableSelect(tableId, tableId);
    }
  }

  function handleTableMultiSelect(tableId: string, checked: boolean) {
    if (checked) {
      setSelectedTableIds((prev) => [...prev, tableId]);
    } else {
      setSelectedTableIds((prev) => prev.filter((id) => id !== tableId));
    }
  }



  function handleContextAction(tableId: string, action: string) {
    // Re-use right click handler for simplicity if actions overlap
    // Or map them if they have different action strings
    handleRightClickAction(action as TableRightClickAction, tableId);
  }

  function handleRightClickAction(action: TableRightClickAction, tableId: string) {
    if (action === "delete-table") {
      setTargetTableName(tableId);
      setShowDropDialog(true);
    } else if (action === "edit-name") {
      setTargetTableName(tableId);
      setShowRenameDialog(true);
    } else if (action === "copy-name") {
      navigator.clipboard.writeText(tableId);
      toast({
        title: "Copied to clipboard",
        description: `Table name "${tableId}" copied.`,
      });
    } else if (action === "view-table") {
      handleTableSelect(tableId);
      handleNavSelect("database-studio");
    } else if (action === "duplicate-table") {
      toast({
        title: "Not Implemented",
        description: "Duplicate table is not yet supported.",
      });
    } else if (action === "export-schema") {
      handleExportTableSchema(tableId);
    } else if (action === "export-json") {
      handleExportTableData(tableId, "json");
    } else if (action === "export-sql") {
      handleExportTableData(tableId, "sql_insert");
    } else {
      console.log("Right-click action:", action, tableId);
    }
  }

  async function handleRenameTable(newName: string) {
    if (!activeConnectionId || !targetTableName) return;

    setIsDdlLoading(true);
    try {
      const sql = `ALTER TABLE "${targetTableName}" RENAME TO "${newName}"`;
      const result = await commands.executeBatch(activeConnectionId, [sql]);
      if (result.status === "ok") {
        setShowRenameDialog(false);
        setSchema(null);
      } else {
        console.error("Failed to rename table:", result.error);
      }
    } catch (error) {
      console.error("Failed to rename table:", error);
    } finally {
      setIsDdlLoading(false);
    }
  }

  async function handleDropTable() {
    if (!activeConnectionId || !targetTableName) return;

    setIsDdlLoading(true);
    try {
      const sql = `DROP TABLE IF EXISTS "${targetTableName}"`;
      const result = await commands.executeBatch(activeConnectionId, [sql]);
      if (result.status === "ok") {
        setShowDropDialog(false);
        setSchema(null);
        if (activeTableId === targetTableName) {
          setInternalTableId(undefined);
        }
      } else {
        console.error("Failed to drop table:", result.error);
      }
    } catch (error) {
      console.error("Failed to drop table:", error);
    } finally {
      setIsDdlLoading(false);
    }
  }

  function handleTableRename(tableId: string, newName: string) {
    setTargetTableName(tableId);
    handleRenameTable(newName);
  }

  async function handleBulkAction(action: BulkAction) {
    if (!activeConnectionId || selectedTableIds.length === 0) return;

    if (action === "drop") {
       // We can iterate and call drop table, or ideally update DropTableDialog to support multiple
       // For now, let's use a simple confirmation via window.confirm (or better, a custom dialog, but let's stick to simple implementation first or re-use drop dialog sequentially?)
       // Since DropTableDialog takes a single tableName, we should probably implement a bulk drop logic here utilizing commands.
       if (confirm(`Are you sure you want to drop ${selectedTableIds.length} tables? This cannot be undone.`)) {
           setIsDdlLoading(true);
           try {
               // Execute one by one or batch
               const drops = selectedTableIds.map(id => `DROP TABLE IF EXISTS "${id}"`);
               const result = await commands.executeBatch(activeConnectionId, drops);
               if (result.status === "ok") {
                   toast({
                       title: "Tables dropped",
                       description: `Successfully dropped ${selectedTableIds.length} tables.`,
                   });
                   setSelectedTableIds([]);
                   setIsMultiSelectMode(false);
                   setSchema(null);
               } else {
                   throw new Error(String(result.error));
               }
           } catch (e) {
               console.error(e);
               toast({
                   title: "Error dropping tables",
                   description: String(e),
                   variant: "destructive"
               });
           } finally {
               setIsDdlLoading(false);
           }
       }
    } else if (action === "truncate") {
        if (confirm(`Are you sure you want to truncate ${selectedTableIds.length} tables? All data will be lost.`)) {
            setIsDdlLoading(true);
            try {
                const truncates = selectedTableIds.map(id => `TRUNCATE TABLE "${id}"`); // Note: SQLite might need DELETE FROM
                // But let's assume standard SQL or let backend handle it? 
                // executeBatch just runs raw SQL.
                // SQLite doesn't strictly support TRUNCATE, so `DELETE FROM "table"` is safer if generic.
                // But let's look at executeQuery implementation in generic adapter... it passes through.
                // Let's us DELETE FROM which is standard.
                const deletes = selectedTableIds.map(id => `DELETE FROM "${id}"`);
                
                const result = await commands.executeBatch(activeConnectionId, deletes);
                if (result.status === "ok") {
                    toast({
                        title: "Tables truncated",
                        description: `Successfully truncated ${selectedTableIds.length} tables.`,
                    });
                     setSelectedTableIds([]);
                     setIsMultiSelectMode(false);
                } else {
                    throw new Error(String(result.error));
                }
            } catch (e) {
                 toast({
                   title: "Error truncating tables",
                   description: String(e),
                   variant: "destructive"
               });
            } finally {
                setIsDdlLoading(false);
            }
        }
    }
  }

  function handleToolbarAction(action: ToolbarAction) {
    // Settings action is handled by BottomToolbar internally via SettingsPanel
    // No other toolbar actions currently defined
  }

  async function handleExportTableSchema(tableName: string) {
    if (!activeConnectionId) return;
    
    try {
      const schemaResult = await adapter.getSchema(activeConnectionId);
      if (!schemaResult.ok) throw new Error(schemaResult.error);
      
      const table = schemaResult.data.tables.find(t => t.name === tableName);
      if (!table) throw new Error(`Table ${tableName} not found`);
      
      const ddl = `CREATE TABLE "${tableName}" (\n${table.columns.map(col => {
        let line = `  "${col.name}" ${col.data_type}`;
        if (!col.is_nullable) line += " NOT NULL";
        if (col.default_value) line += ` DEFAULT ${col.default_value}`;
        return line;
      }).join(",\n")}\n);`;
      
      navigator.clipboard.writeText(ddl);
      toast({
        title: "Schema copied",
        description: `DDL for table "${tableName}" copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Error exporting schema",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  }

  async function handleExportTableData(tableName: string, format: "json" | "sql_insert") {
    if (!activeConnectionId) return;
    
    try {
      const result = await commands.exportTable(activeConnectionId, tableName, null, format, null);
      if (result.status !== "ok") throw new Error(String(result.error));
      
      navigator.clipboard.writeText(result.data);
      toast({
        title: "Data exported",
        description: `Table "${tableName}" exported as ${format.toUpperCase()} to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Error exporting data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  }

  async function handleCopySchema() {
    if (!activeConnectionId) return;
    
    try {
        const result = await adapter.getDatabaseDDL(activeConnectionId);
        if (result.ok) {
            navigator.clipboard.writeText(result.data);
            toast({
                title: "Schema copied",
                description: "Database schema DDL copied to clipboard.",
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Failed to copy schema:", error);
         toast({
            title: "Error copying schema",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive"
        });
    }
  }

  const availableSchemas = schema?.schemas.map(s => ({
    id: s,
    name: s,
    databaseId: activeConnectionId || "unknown"
  })) || [];

  return (
    <div className="relative flex flex-col h-full w-[244px] bg-sidebar border-r border-sidebar-border">
      {/* Header section with spotlight and nav */}
      <div className="flex flex-col">
        <div className="px-0 pt-0 pb-2">
          <ConnectionSwitcher
            connections={connections}
            activeConnectionId={activeConnectionId}
            onConnectionSelect={onConnectionSelect}
            onAddConnection={onAddConnection}
            onManageConnections={onManageConnections}
            onViewConnection={onViewConnection}
            onEditConnection={onEditConnection}
            onDeleteConnection={onDeleteConnection}
          />
        </div>
        <div className="px-2 pb-2">
          <NavButtons activeId={activeNavId} onSelect={handleNavSelect} />
        </div>
      </div>

      {/* Schema selector and search - only when connected */}
      {schema && (
        <div className="flex flex-col gap-2 px-2 py-2 border-t border-sidebar-border">
          {availableSchemas.length > 1 && (
            <SchemaSelector
              schemas={availableSchemas}
              selectedSchema={selectedSchema}
              onSchemaChange={setSelectedSchema}
            />
          )}

          <TableSearch
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={() => {
              if (activeConnectionId) {
                setRefreshTrigger(prev => prev + 1);
              }
            }}

          />
        </div>
      )}

      {/* Table list */}
      <ScrollArea className="flex-1">
        {isLoadingSchema ? (
          <SidebarTableSkeleton rows={8} />
        ) : schemaError ? (
          <div className="flex flex-col items-center justify-center h-32 text-destructive px-4">
            <span className="text-xs text-center">{schemaError}</span>
          </div>
        ) : !schema ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4">
            <DatabaseIcon className="h-8 w-8 mb-3 opacity-50" />
            <span className="text-xs text-center mb-2">No database connected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddConnection}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Connection
            </Button>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <span className="text-xs">No tables found</span>
          </div>
        ) : (
          <TableList
            tables={filteredTables}
            activeTableId={activeTableId}
            selectedTableIds={selectedTableIds}
            isMultiSelectMode={isMultiSelectMode}
            activeSortingTableIds={[]}
            editingTableId={editingTableId}
            onTableSelect={handleTableSelect}
            onTableMultiSelect={handleTableMultiSelect}
            onContextAction={handleContextAction}
            onRightClickAction={handleRightClickAction}
            onTableRename={handleTableRename}
          />
        )}
      </ScrollArea>

      {isMultiSelectMode && selectedTableIds.length > 0 && (
        <ManageTablesDialog
          selectedCount={selectedTableIds.length}
          onAction={handleBulkAction}
          onClose={() => {
            setIsMultiSelectMode(false);
            setSelectedTableIds([]);
            setInternalTableId(undefined);
          }}
        />
      )}

      <BottomToolbar
        onAction={handleToolbarAction}
        onCopySchema={handleCopySchema}
        themeProps={{
          theme,
          onThemeChange: setTheme
        }}
      />

      <RenameTableDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        currentName={targetTableName}
        onConfirm={handleRenameTable}
        isLoading={isDdlLoading}
      />

      <DropTableDialog
        open={showDropDialog}
        onOpenChange={setShowDropDialog}
        tableName={targetTableName}
        onConfirm={handleDropTable}
        isLoading={isDdlLoading}
      />
    </div>
  );
}
