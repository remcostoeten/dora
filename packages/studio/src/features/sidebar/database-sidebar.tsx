import { Plus, Database as DatabaseIcon } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { SidebarTableSkeleton } from "@studio/shared/ui/skeleton";
import { useToast } from "@studio/shared/ui/use-toast";
import { toast as appToast } from "@studio/shared/ui/notifier";
import { useAdapter, useSchema } from "@studio/core/data-provider";
import { useIsTauri } from "@studio/core/data-provider/context";
import { getAdapterError } from "@studio/core/data-provider/types";
import type { DatabaseSchema, TableInfo } from "@studio/lib/bindings";
import { commands } from "@studio/lib/bindings";
import { getAppearanceSettings, applyAppearanceToDOM } from "@studio/shared/lib/appearance-store";
import { loadFontPair } from "@studio/shared/lib/font-loader";
import { formatBackendError } from "@studio/shared/utils/backend-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@studio/shared/ui/alert-dialog";
import { Button } from "@studio/shared/ui/button";
import { ScrollArea } from "@studio/shared/ui/scroll-area";
import { ConnectionSwitcher } from "../connections/components/connection-switcher";
import { Connection } from "../connections/types";
import { DropTableDialog } from "../database-studio/components/drop-table-dialog";
import { BottomToolbar } from "./components/bottom-toolbar";
import { ManageTablesDialog, BulkAction } from "./components/manage-tables-dialog";
import { RenameTableDialog } from "./components/rename-table-dialog";
import { SchemaSelector } from "./components/schema-selector";
import { SidebarBottomPanel } from "./components/sidebar-bottom-panel";
import { TableInfoDialog } from "./components/table-info-dialog";
import { TableList } from "./components/table-list";
import type { TableRightClickAction } from "./components/table-list";
import { TableSearch, FilterState } from "./components/table-search";
import {
  useSidebarWidth,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "./hooks/use-sidebar-width";
import { Schema, TableItem } from "./types";
import { cn } from "@studio/shared/utils/cn";
import {
  getTableRefId,
  getTableRefParts,
  getTableSqlIdentifier,
} from "@studio/shared/utils/table-ref";
import { prefetchTableData } from "../database-studio/utils/table-cache";

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
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
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
  onConnectionSelect = function () {},
  onAddConnection = function () {},
  onManageConnections = function () {},
  onViewConnection,
  onEditConnection,
  onDeleteConnection,
  onToggleSidebar,
  isSidebarOpen = true,
}: Props = {}) {
  const { toast } = useToast();
  const adapter = useAdapter();
  const isTauri = useIsTauri();
  const { width, isResizing, startResize, resetWidth, nudgeWidth } = useSidebarWidth();
  const [internalNavId, setInternalNavId] = useState("database-studio");
  const activeNavId = controlledNavId ?? internalNavId;

  function handleNavSelect(id: string) {
    if (onNavSelect) {
      onNavSelect(id);
    } else {
      setInternalNavId(id);
    }
  }

  const [selectedSchema, setSelectedSchema] = useState<Schema | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [internalTableId, setInternalTableId] = useState<string | undefined>();
  const activeTableId = selectedTableId ?? internalTableId;
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | undefined>();

  // Shares the ['schema', connectionId] query with DatabaseStudio — a private
  // fetch here meant every connect ran connect + introspection twice.
  const schemaQuery = useSchema(activeConnectionId);
  const schema: DatabaseSchema | null = schemaQuery.data ?? null;
  const isLoadingSchema = schemaQuery.isFetching;
  const schemaError = schemaQuery.isError
    ? schemaQuery.error instanceof Error
      ? schemaQuery.error.message
      : "Failed to load schema"
    : null;

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDropDialog, setShowDropDialog] = useState(false);
  const [showTruncateDialog, setShowTruncateDialog] = useState(false);
  const [targetTableName, setTargetTableName] = useState<string>("");
  const [isDdlLoading, setIsDdlLoading] = useState(false);
  const [showTableInfoDialog, setShowTableInfoDialog] = useState(false);
  const [tableInfoTarget, setTableInfoTarget] = useState<string>("");
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{
    open: boolean;
    action: BulkAction | null;
  }>({ open: false, action: null });

  const refreshSchema = useCallback(
    function () {
      window.dispatchEvent(
        new CustomEvent("dora-schema-refresh", { detail: { connectionId: activeConnectionId } }),
      );
    },
    [activeConnectionId],
  );

  useEffect(function initAppearance() {
    const settings = getAppearanceSettings();
    applyAppearanceToDOM(settings);
    if (settings.fontPair !== "system") {
      loadFontPair(settings.fontPair);
    }
  }, []);

  useEffect(
    function reportSchemaError() {
      if (!schemaQuery.isError) return;
      const error = schemaQuery.error;
      console.error("Failed to fetch schema:", error);
      appToast.error("Failed to fetch schema", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
    [schemaQuery.isError, schemaQuery.error],
  );

  useEffect(
    function syncSelectedSchema() {
      if (!schema || schema.schemas.length === 0 || !activeConnectionId) {
        setSelectedSchema(undefined);
        return;
      }
      setSelectedSchema(function (current) {
        if (current && schema.schemas.includes(current.name)) return current;
        return {
          id: schema.schemas[0],
          name: schema.schemas[0],
          databaseId: activeConnectionId,
        };
      });
    },
    [schema, activeConnectionId],
  );

  useEffect(
    function handleAutoSelectFirstTable() {
      if (!autoSelectFirstTable || !schema || schema.tables.length === 0 || !onTableSelect) return;
      const firstTable = schema.tables[0];
      onTableSelect(getTableRefId(firstTable), firstTable.name);
      if (onAutoSelectComplete) {
        onAutoSelectComplete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, autoSelectFirstTable],
  );

  const tables = useMemo(
    function (): TableItem[] {
      if (!schema) return [];
      return schema.tables.map(function (table: TableInfo) {
        return {
          id: getTableRefId(table),
          name: table.name,
          rowCount: table.row_count_estimate ?? 0,
          type: "table" as const,
        };
      });
    },
    [schema],
  );

  const filteredTables = useMemo(
    function () {
      if (!schema) return [];

      return tables
        .filter(function (table) {
          if (searchValue && !table.name.toLowerCase().includes(searchValue.toLowerCase())) {
            return false;
          }
          return true;
        })
        .filter(function (table) {
          if (table.type === "table" && !filters.showTables) return false;
          if (table.type === "view" && !filters.showViews) return false;
          if (table.type === "materialized-view" && !filters.showMaterializedViews) return false;
          return true;
        });
    },
    [schema, tables, searchValue, filters],
  );

  const activeTable = useMemo(
    function () {
      if (!schema || !activeTableId) return null;
      return schema.tables.find(function (t) {
        return getTableRefId(t) === activeTableId;
      });
    },
    [schema, activeTableId],
  );
  const activeConnection = useMemo(
    function () {
      if (!activeConnectionId) return null;
      return (
        connections.find(function (connection) {
          return connection.id === activeConnectionId;
        }) || null
      );
    },
    [connections, activeConnectionId],
  );

  function handleTableSelect(tableId: string) {
    setInternalTableId(tableId);
    if (onTableSelect) {
      onTableSelect(tableId, getTableRefParts(tableId).tableName);
    }
  }

  const handleTablePrefetch = useCallback(
    function (tableId: string) {
      void prefetchTableData(adapter, activeConnectionId, tableId);
    },
    [adapter, activeConnectionId],
  );

  function handleTableMultiSelect(tableId: string, checked: boolean) {
    if (checked) {
      setSelectedTableIds(function (prev) {
        return [...prev, tableId];
      });
    } else {
      setSelectedTableIds(function (prev) {
        return prev.filter(function (id) {
          return id !== tableId;
        });
      });
    }
  }

  function handleContextAction(tableId: string, action: string) {
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
      const tableName = getTableRefParts(tableId).tableName;
      navigator.clipboard.writeText(tableName);
      toast({
        title: "Copied to clipboard",
        description: `Table name "${tableName}" copied.`,
      });
    } else if (action === "view-table") {
      handleTableSelect(tableId);
      handleNavSelect("database-studio");
    } else if (action === "open-in-sql-console") {
      handleNavSelect("sql-console");
      window.setTimeout(function () {
        window.dispatchEvent(
          new CustomEvent("dora-open-table-in-sql", { detail: { tableName: tableId } }),
        );
      }, 0);
    } else if (action === "duplicate-table") {
      handleDuplicateTable(tableId);
    } else if (action === "view-info") {
      setTableInfoTarget(tableId);
      setShowTableInfoDialog(true);
    } else if (action === "export-schema") {
      handleExportTableSchema(tableId);
    } else if (action === "export-json") {
      handleExportTableData(tableId, "json");
    } else if (action === "export-sql") {
      handleExportTableData(tableId, "sql_insert");
    } else if (action === "truncate") {
      setTargetTableName(tableId);
      setShowTruncateDialog(true);
    }
  }

  async function handleRenameTable(currentTableName: string, newName: string) {
    if (!activeConnectionId || !currentTableName) return;

    setIsDdlLoading(true);
    try {
      const sql = `ALTER TABLE ${getTableSqlIdentifier(currentTableName)} RENAME TO "${newName}"`;
      const result = await commands.executeBatch(activeConnectionId, [sql]);
      if (result.status === "ok") {
        setShowRenameDialog(false);
        if (targetTableName === currentTableName) {
          setTargetTableName("");
        }
        // Don't null the schema — that blanks the tree before the refetch
        // returns (flash). The refetch keeps the current tree visible and
        // swaps in the renamed table when it lands.
        refreshSchema();
      } else {
        console.error("Failed to rename table:", result.error);
        appToast.error("Failed to rename table", {
          description: formatBackendError(result.error),
        });
      }
    } catch (error) {
      console.error("Failed to rename table:", error);
      appToast.error("Failed to rename table", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDdlLoading(false);
    }
  }

  async function handleDropTable() {
    if (!activeConnectionId || !targetTableName) return;

    setIsDdlLoading(true);
    try {
      const result = await adapter.dropTable(activeConnectionId, targetTableName);
      if (result.ok) {
        setShowDropDialog(false);
        // Keep the tree painted during the refetch; nulling it flashes an
        // empty sidebar before the fresh schema arrives.
        refreshSchema();
        if (activeTableId === targetTableName) {
          setInternalTableId(undefined);
        }
        toast({
          title: "Table dropped",
          description: `"${targetTableName}" has been removed.`,
          variant: "success",
        });
      } else {
        const errorMessage = getAdapterError(result);
        console.error("Failed to drop table:", errorMessage);
        appToast.error("Failed to drop table", {
          description: errorMessage,
        });
      }
    } catch (error) {
      console.error("Failed to drop table:", error);
      appToast.error("Failed to drop table", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDdlLoading(false);
    }
  }

  async function handleTruncateTable() {
    if (!activeConnectionId || !targetTableName) return;

    setIsDdlLoading(true);
    try {
      const result = await commands.executeBatch(activeConnectionId, [
        `DELETE FROM ${getTableSqlIdentifier(targetTableName)}`,
      ]);
      if (result.status === "ok") {
        setShowTruncateDialog(false);
        refreshSchema();
        toast({
          title: "Table truncated",
          description: `All rows from "${getTableRefParts(targetTableName).tableName}" have been deleted.`,
          variant: "success",
        });
      } else {
        throw new Error(formatBackendError(result.error));
      }
    } catch (error) {
      appToast.error("Failed to truncate table", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDdlLoading(false);
    }
  }

  function handleTableRename(tableId: string, newName: string) {
    setTargetTableName(tableId);
    void handleRenameTable(tableId, newName);
  }

  function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  function toSqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "NULL";
    }
    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return `'${escapeSqlString(value.toISOString())}'`;
    }
    if (typeof value === "object") {
      return `'${escapeSqlString(JSON.stringify(value))}'`;
    }

    return `'${escapeSqlString(String(value))}'`;
  }

  function buildInsertExport(tableName: string, rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return `-- No rows to export for ${getTableSqlIdentifier(tableName)}`;
    }

    const columns = Object.keys(rows[0]);
    const columnList = columns
      .map(function (column) {
        return `"${column}"`;
      })
      .join(", ");

    const valueGroups = rows
      .map(function (row) {
        const values = columns
          .map(function (column) {
            return toSqlLiteral(row[column]);
          })
          .join(", ");

        return `(${values})`;
      })
      .join(",\n");

    return `INSERT INTO ${getTableSqlIdentifier(tableName)} (${columnList}) VALUES\n${valueGroups};`;
  }

  async function handleDuplicateTable(tableName: string) {
    if (!activeConnectionId) return;
    const tableRef = getTableRefParts(tableName);
    if (!isTauri) {
      toast({
        title: "Duplicate table not available",
        description: "Table duplication is not available in the web demo.",
        variant: "destructive",
      });
      return;
    }
    if (activeConnection?.type !== "postgres") {
      toast({
        title: "Duplicate table not available",
        description: "Table duplication is currently supported for PostgreSQL connections only.",
        variant: "destructive",
      });
      return;
    }

    setIsDdlLoading(true);
    try {
      // Find a unique name
      let newName = `${tableRef.tableName}_copy`;
      let counter = 1;
      while (
        schema?.tables.some(function (t) {
          return t.schema === tableRef.schemaName && t.name === newName;
        })
      ) {
        counter++;
        newName = `${tableRef.tableName}_copy${counter}`;
      }

      const sqlCreate = `CREATE TABLE ${getTableSqlIdentifier({ name: newName, schema: tableRef.schemaName })} (LIKE ${getTableSqlIdentifier(tableName)} INCLUDING ALL)`;
      const sqlData = `INSERT INTO ${getTableSqlIdentifier({ name: newName, schema: tableRef.schemaName })} SELECT * FROM ${getTableSqlIdentifier(tableName)}`;

      const result = await commands.executeBatch(activeConnectionId, [sqlCreate, sqlData]);

      if (result.status === "ok") {
        toast({
          title: "Table duplicated",
          description: `Table "${tableName}" duplicated as "${newName}".`,
          variant: "success",
        });
        // Keep the current tree visible during the refetch; the duplicated
        // table appears when the fresh schema lands, no empty-tree flash.
        refreshSchema();
      } else {
        throw new Error(formatBackendError(result.error));
      }
    } catch (error) {
      console.error("Failed to duplicate table:", error);
      appToast.error("Failed to duplicate table", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDdlLoading(false);
    }
  }

  function handleBulkAction(action: BulkAction) {
    if (!activeConnectionId || selectedTableIds.length === 0) return;

    if (action === "drop" || action === "truncate") {
      setBulkActionConfirm({ open: true, action });
    }
  }

  async function executeBulkAction() {
    if (!activeConnectionId || !bulkActionConfirm.action) return;

    const action = bulkActionConfirm.action;
    setBulkActionConfirm({ open: false, action: null });

    if (action === "drop") {
      setIsDdlLoading(true);
      try {
        const drops = selectedTableIds.map(function (id) {
          return `DROP TABLE IF EXISTS ${getTableSqlIdentifier(id)}`;
        });
        const result = await commands.executeBatch(activeConnectionId, drops);
        if (result.status === "ok") {
          toast({
            title: "Tables dropped",
            description: `Successfully dropped ${selectedTableIds.length} tables.`,
            variant: "success",
          });
          setSelectedTableIds([]);
          setIsMultiSelectMode(false);
          // Don't blank the tree — let the refetch swap the dropped tables out
          // when the fresh schema arrives, instead of flashing an empty list.
          refreshSchema();
        } else {
          throw new Error(formatBackendError(result.error));
        }
      } catch (e) {
        console.error(e);
        appToast.error("Failed to drop tables", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setIsDdlLoading(false);
      }
    } else if (action === "truncate") {
      setIsDdlLoading(true);
      try {
        const deletes = selectedTableIds.map(function (id) {
          return `DELETE FROM ${getTableSqlIdentifier(id)}`;
        });
        const result = await commands.executeBatch(activeConnectionId, deletes);
        if (result.status === "ok") {
          toast({
            title: "Tables truncated",
            description: `Successfully truncated ${selectedTableIds.length} tables.`,
            variant: "success",
          });
          setSelectedTableIds([]);
          setIsMultiSelectMode(false);
          refreshSchema();
        } else {
          throw new Error(formatBackendError(result.error));
        }
      } catch (e) {
        toast({
          title: "Error truncating tables",
          description: String(e),
          variant: "destructive",
        });
      } finally {
        setIsDdlLoading(false);
      }
    }
  }

  async function handleExportTableSchema(tableName: string) {
    if (!activeConnectionId) return;

    try {
      const schemaResult = await adapter.getSchema(activeConnectionId);
      if (!schemaResult.ok) throw new Error(getAdapterError(schemaResult));

      const table = schemaResult.data.tables.find(function (t) {
        return getTableRefId(t) === tableName;
      });
      if (!table) throw new Error(`Table ${tableName} not found`);

      const ddl = `CREATE TABLE ${getTableSqlIdentifier(table)} (\n${table.columns
        .map(function (col) {
          let line = `  "${col.name}" ${col.data_type}`;
          if (!col.is_nullable) line += " NOT NULL";
          if (col.default_value) line += ` DEFAULT ${col.default_value}`;
          return line;
        })
        .join(",\n")}\n);`;

      navigator.clipboard.writeText(ddl);
      toast({
        title: "Schema copied",
        description: `DDL for table "${tableName}" copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Error exporting schema",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleExportTableData(tableName: string, format: "json" | "sql_insert") {
    if (!activeConnectionId) return;

    try {
      if (!isTauri) {
        const exportResult = await adapter.fetchTableData(activeConnectionId, tableName, 0, 10000);
        if (!exportResult.ok) throw new Error(getAdapterError(exportResult));

        const payload =
          format === "json"
            ? JSON.stringify(exportResult.data.rows, null, 2)
            : buildInsertExport(tableName, exportResult.data.rows);

        navigator.clipboard.writeText(payload);
        toast({
          title: "Data exported",
          description: `Table "${tableName}" exported as ${format.toUpperCase()} to clipboard.`,
          variant: "success",
        });
        return;
      }

      const result = await commands.exportTable(
        activeConnectionId,
        getTableRefParts(tableName).tableName,
        getTableRefParts(tableName).schemaName,
        format,
        null,
        null,
        null,
      );
      if (result.status !== "ok") throw new Error(formatBackendError(result.error));

      navigator.clipboard.writeText(result.data);
      toast({
        title: "Data exported",
        description: `Table "${tableName}" exported as ${format.toUpperCase()} to clipboard.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error exporting data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
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
        throw new Error(getAdapterError(result));
      }
    } catch (error) {
      console.error("Failed to copy schema:", error);
      appToast.error("Failed to copy schema", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const availableSchemas =
    schema?.schemas.map(function (s) {
      return {
        id: s,
        name: s,
        databaseId: activeConnectionId || "unknown",
      };
    }) || [];

  return (
    <div
      className="relative flex flex-col h-full shrink-0 bg-sidebar border-r border-sidebar-border select-none"
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        tabIndex={0}
        className={cn(
          "absolute inset-y-0 right-0 z-20 w-1.5 translate-x-1/2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none",
          isResizing && "bg-primary/60",
        )}
        onMouseDown={startResize}
        onDoubleClick={resetWidth}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudgeWidth(event.shiftKey ? -32 : -8);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            nudgeWidth(event.shiftKey ? 32 : 8);
          }
        }}
      />

      <div className="flex flex-col shrink-0">
        <div className="p-0">
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
      </div>

      {schema && (
        <div className="flex flex-col gap-2 px-2 py-2 border-t border-sidebar-border shrink-0">
          {availableSchemas.length > 1 && selectedSchema && (
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
            isRefreshing={isLoadingSchema}
            onRefresh={function () {
              if (activeConnectionId) {
                refreshSchema();
              }
            }}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1" style={{ flex: 1 }}>
        {isLoadingSchema && !schema ? (
          <SidebarTableSkeleton rows={8} />
        ) : schemaError ? (
          <div className="flex flex-col items-center justify-center h-40 px-4 py-6 gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="h-5 w-5 text-destructive"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-xs font-medium text-foreground">Connection failed</h4>
              <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
                {schemaError}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-3 mt-1"
              onClick={function () {
                refreshSchema();
              }}
            >
              Try again
            </Button>
          </div>
        ) : !schema ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4">
            <DatabaseIcon className="h-8 w-8 mb-3 opacity-50" />
            <span className="text-xs text-center mb-2">No database connected</span>
            <Button variant="outline" size="sm" onClick={onAddConnection} className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Connection
            </Button>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <span className="text-xs">No tables found</span>
          </div>
        ) : (
          <div className="relative">
            <TableList
              tables={filteredTables}
              activeTableId={activeTableId}
              selectedTableIds={selectedTableIds}
              isMultiSelectMode={isMultiSelectMode}
              activeSortingTableIds={[]}
              editingTableId={editingTableId}
              onTableSelect={handleTableSelect}
              onTablePrefetch={handleTablePrefetch}
              onTableMultiSelect={handleTableMultiSelect}
              onContextAction={handleContextAction}
              onRightClickAction={handleRightClickAction}
              onTableRename={handleTableRename}
            />
            {isLoadingSchema && (
              <div className="absolute right-2 top-2 rounded bg-sidebar-accent/90 px-2 py-0.5 text-[10px] text-muted-foreground">
                Refreshing...
              </div>
            )}
          </div>
        )}
        </ScrollArea>

        {activeTable ? <SidebarBottomPanel table={activeTable} /> : null}
      </div>

      {isMultiSelectMode && selectedTableIds.length > 0 && (
        <ManageTablesDialog
          selectedCount={selectedTableIds.length}
          onAction={handleBulkAction}
          onClose={function () {
            setIsMultiSelectMode(false);
            setSelectedTableIds([]);
            setInternalTableId(undefined);
          }}
        />
      )}

      <BottomToolbar
        onToggleSidebar={onToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onAction={function (action) {
          if (action === "settings") {
            handleNavSelect("settings");
          }
        }}
      />

      <RenameTableDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        currentName={targetTableName}
        onConfirm={function handleRenameConfirm(newName: string) {
          return handleRenameTable(targetTableName, newName);
        }}
        isLoading={isDdlLoading}
      />

      <DropTableDialog
        open={showDropDialog}
        onOpenChange={setShowDropDialog}
        tableName={targetTableName}
        onConfirm={handleDropTable}
        isLoading={isDdlLoading}
      />

      <AlertDialog
        open={showTruncateDialog}
        onOpenChange={(open) => {
          if (!open) setShowTruncateDialog(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Truncate Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all rows from &quot;
              {getTableRefParts(targetTableName).tableName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDdlLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTruncateTable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDdlLoading}
            >
              Truncate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeConnectionId && (
        <TableInfoDialog
          open={showTableInfoDialog}
          onOpenChange={setShowTableInfoDialog}
          tableName={tableInfoTarget}
          connectionId={activeConnectionId}
          tableInfo={
            schema?.tables.find(function (table) {
              return getTableRefId(table) === tableInfoTarget;
            }) ?? null
          }
          connectionType={activeConnection?.type ?? null}
        />
      )}

      <AlertDialog
        open={bulkActionConfirm.open}
        onOpenChange={(open) => {
          if (!open) setBulkActionConfirm({ open: false, action: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionConfirm.action === "drop" ? "Drop Tables" : "Truncate Tables"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionConfirm.action === "drop"
                ? `Are you sure you want to drop ${selectedTableIds.length} table${selectedTableIds.length > 1 ? "s" : ""}? This action cannot be undone.`
                : `Are you sure you want to truncate ${selectedTableIds.length} table${selectedTableIds.length > 1 ? "s" : ""}? All data will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkActionConfirm.action === "drop" ? "Drop" : "Truncate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
