import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
// import { SpotlightTrigger } from "./components/spotlight-trigger"; // Replaced by ConnectionSwitcher
import { ConnectionSwitcher } from "../connections/components/connection-switcher";
import { NavButtons } from "./components/nav-buttons";
import { SchemaSelector } from "./components/schema-selector";
import { TableSearch, FilterState } from "./components/table-search";
import { TableList } from "./components/table-list";
import type { TableRightClickAction } from "./components/table-list";
import { AddMenu, AddAction } from "./components/add-menu";
import { BottomToolbar, ToolbarAction, Theme } from "./components/bottom-toolbar";
import { SettingsPanel, SettingsState } from "./components/settings-panel";
import { ManageTablesDialog, BulkAction } from "./components/manage-tables-dialog";
import { MOCK_SCHEMAS, MOCK_DATABASES, getTablesBySchema } from "./data";
import { Schema, TableItem, Database } from "./types";
import { Connection } from "../connections/types";
import { Button } from "@/shared/ui/button";
import { Plus, Loader2, Database as DatabaseIcon } from "lucide-react";
import { connectToDatabase } from "../connections/api";
import { getSchema } from "../database-studio/api";
import type { DatabaseSchema, TableInfo } from "@/lib/bindings";
const DEFAULT_FILTERS: FilterState = {
  showTables: true,
  showViews: true,
  showMaterializedViews: true,
};

const DEFAULT_SETTINGS: SettingsState = {
  tableRowsCount: true,
  expandSubviews: false,
  paginationType: "LIMIT OFFSET",
  flatSchemas: false,
  byteaFormat: "HEX",
  editorFontSize: 14,
  editorKeybindings: "VS Code",
};

type Props = {
  activeNavId?: string;
  onNavSelect?: (id: string) => void;
  onTableSelect?: (tableId: string, tableName: string) => void;
  selectedTableId?: string;

  // Connection props
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
  connections = [],
  activeConnectionId,
  onConnectionSelect = () => { },
  onAddConnection = () => { },
  onManageConnections = () => { },
  onViewConnection,
  onEditConnection,
  onDeleteConnection,
}: Props = {}) {
  const [internalNavId, setInternalNavId] = useState("database-studio");
  const activeNavId = controlledNavId ?? internalNavId;

  const handleNavSelect = (id: string) => {
    if (onNavSelect) {
      onNavSelect(id);
    } else {
      setInternalNavId(id);
    }
  };

  const [selectedDatabase, setSelectedDatabase] = useState<Database>(MOCK_DATABASES[0]);
  const [selectedSchema, setSelectedSchema] = useState<Schema>(() => {
    const schemas = MOCK_DATABASES[0].schemas.map(s => ({
      id: `${MOCK_DATABASES[0].id}.${s}`,
      name: s,
      databaseId: MOCK_DATABASES[0].id,
    }));
    return schemas[0];
  });
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [internalTableId, setInternalTableId] = useState<string | undefined>();
  const activeTableId = selectedTableId ?? internalTableId;
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | undefined>();
  // const [showSettings, setShowSettings] = useState(false); // Removed in favor of Popover
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<Theme>("dark");

  // Real database schema state
  const [realSchema, setRealSchema] = useState<DatabaseSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Detect if running in Tauri (desktop) - check immediately on init
  const [isTauri] = useState(() => {
    const hasTauri = typeof window !== "undefined" && (
      "__TAURI__" in window ||
      "__TAURI_INTERNALS__" in window ||
      // @ts-ignore - check for tauri object
      window.__TAURI__ !== undefined
    );
    return hasTauri;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "bordered");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Fetch real schema when connection changes
  useEffect(() => {
    async function fetchSchema() {
      if (!activeConnectionId) {
        setRealSchema(null);
        return;
      }

      setIsLoadingSchema(true);
      setSchemaError(null);

      try {
        // First connect to the database
        await connectToDatabase(activeConnectionId);
        // Then fetch the schema
        const schema = await getSchema(activeConnectionId);
        setRealSchema(schema);
      } catch (error) {
        console.error("Failed to fetch schema:", error);
        setSchemaError(error instanceof Error ? error.message : "Failed to load schema");
        setRealSchema(null);
      } finally {
        setIsLoadingSchema(false);
      }
    }

    fetchSchema();
  }, [activeConnectionId]);

  // Convert backend TableInfo to frontend TableItem format
  const realTables = useMemo((): TableItem[] => {
    if (!realSchema) return [];
    return realSchema.tables.map((table: TableInfo) => ({
      id: table.name,
      name: table.name,
      rowCount: table.row_count_estimate ?? 0,
      type: "table" as const, // Backend doesn't distinguish views yet
    }));
  }, [realSchema]);

  const filteredTables = useMemo(() => {
    // Use real tables if connected and schema loaded
    // On Tauri (desktop): only show real tables, no mock data
    // On web: show mock data as demo when not connected
    if (realSchema) {
      return realTables.filter((table) => {
        if (searchValue && !table.name.toLowerCase().includes(searchValue.toLowerCase())) {
          return false;
        }
        if (table.type === "table" && !filters.showTables) return false;
        if (table.type === "view" && !filters.showViews) return false;
        if (table.type === "materialized-view" && !filters.showMaterializedViews) return false;
        return true;
      });
    }

    // On Tauri without connection, return empty (user needs to connect)
    if (isTauri) {
      return [];
    }

    // On web, show mock demo data
    const tables = getTablesBySchema(selectedDatabase.id, selectedSchema.name);
    return tables.filter((table) => {
      if (searchValue && !table.name.toLowerCase().includes(searchValue.toLowerCase())) {
        return false;
      }
      if (table.type === "table" && !filters.showTables) return false;
      if (table.type === "view" && !filters.showViews) return false;
      if (table.type === "materialized-view" && !filters.showMaterializedViews) return false;
      return true;
    });
  }, [selectedDatabase, selectedSchema, searchValue, filters, realSchema, realTables]);

  // Show mock UI only on web (not Tauri)
  const showMockUI = !isTauri && !realSchema;

  function handleTableSelect(tableId: string) {
    setInternalTableId(tableId);
    if (onTableSelect) {
      // When connected to a real database, use just the table name
      // Otherwise, use the mock database/schema format
      if (realSchema) {
        onTableSelect(tableId, tableId);
      } else {
        const tables = getTablesBySchema(selectedDatabase.id, selectedSchema.name);
        const table = tables.find((t) => t.id === tableId);
        const fullTableId = `${selectedDatabase.id}.${selectedSchema.name}.${tableId}`;
        onTableSelect(fullTableId, table?.name ?? tableId);
      }
    }
  }

  function handleTableMultiSelect(tableId: string, checked: boolean) {
    if (checked) {
      setSelectedTableIds((prev) => [...prev, tableId]);
    } else {
      setSelectedTableIds((prev) => prev.filter((id) => id !== tableId));
    }
  }

  function handleMultiSelectToggle() {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (isMultiSelectMode) {
      setSelectedTableIds([]);
    }
  }

  function handleAddAction(action: AddAction) {
    console.log("Add action:", action);
  }

  function handleContextAction(tableId: string, action: string) {
    console.log("Context action:", tableId, action);
  }

  function handleRightClickAction(action: TableRightClickAction, tableId: string) {
    console.log("Right-click action:", action, tableId);
  }

  function handleTableRename(tableId: string, newName: string) {
    console.log("Rename table:", tableId, newName);
    setEditingTableId(undefined);
  }

  function handleBulkAction(action: BulkAction) {
    console.log("Bulk action:", action, selectedTableIds);
    setSelectedTableIds([]);
    setIsMultiSelectMode(false);
  }

  function handleToolbarAction(action: ToolbarAction) {
    // Settings is now handled by the Popover in BottomToolbar
    if (action !== "settings") {
      console.log("Toolbar action:", action);
    }
  }

  function handleCopySchema() {
    console.log("Copy schema");
  }

  const filteredSchemas = MOCK_SCHEMAS.filter(s => s.databaseId === selectedDatabase.id);

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

      {/* Mock database/schema selectors - only show on web when NOT connected to real DB */}
      {showMockUI && (
        <>
          <div className="px-2 pt-2 pb-1 border-t border-sidebar-border">
            <select
              value={selectedDatabase.id}
              onChange={(e) => {
                const db = MOCK_DATABASES.find(d => d.id === e.target.value);
                if (db) {
                  setSelectedDatabase(db);
                  const schemas = db.schemas.map(s => ({
                    id: `${db.id}.${s}`,
                    name: s,
                    databaseId: db.id,
                  }));
                  setSelectedSchema(schemas[0]);
                }
              }}
              className="w-full h-8 px-2 text-xs bg-background border border-sidebar-border rounded-md text-sidebar-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              {MOCK_DATABASES.map(db => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 px-2 py-2">
            <SchemaSelector
              schemas={filteredSchemas}
              selectedSchema={selectedSchema}
              onSchemaChange={(schema) => {
                setSelectedSchema(schema);
                setInternalTableId(undefined);
              }}
            />

            <TableSearch
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              filters={filters}
              onFiltersChange={setFilters}
              onRefresh={() => console.log("Refresh")}
              onAddAction={handleAddAction}
            />
          </div>
        </>
      )}

      {/* Search bar when connected to real DB */}
      {realSchema && (
        <div className="flex flex-col gap-2 px-2 py-2 border-t border-sidebar-border">
          <TableSearch
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={() => {
              if (activeConnectionId) {
                setIsLoadingSchema(true);
                getSchema(activeConnectionId).then(setRealSchema).finally(() => setIsLoadingSchema(false));
              }
            }}
            onAddAction={handleAddAction}
          />
        </div>
      )}

      {/* Table list */}
      <ScrollArea className="flex-1">
        {isLoadingSchema ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-xs">Loading tables...</span>
          </div>
        ) : schemaError ? (
          <div className="flex flex-col items-center justify-center h-32 text-destructive px-4">
            <span className="text-xs text-center">{schemaError}</span>
          </div>
        ) : filteredTables.length === 0 && realSchema ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <span className="text-xs">No tables found</span>
          </div>
        ) : filteredTables.length === 0 && isTauri && !realSchema && !isLoadingSchema ? (
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
        settingsProps={{
          settings,
          onSettingsChange: setSettings,
          onCopySchema: handleCopySchema
        }}
        themeProps={{
          theme,
          onThemeChange: setTheme
        }}
      />
    </div>
  );
}
