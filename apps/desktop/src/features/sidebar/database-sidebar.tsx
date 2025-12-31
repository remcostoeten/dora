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
import { Plus } from "lucide-react";

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

  const filteredTables = useMemo(() => {
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
  }, [selectedDatabase, selectedSchema, searchValue, filters]);

  function handleTableSelect(tableId: string) {
    setInternalTableId(tableId);
    if (onTableSelect) {
      const tables = getTablesBySchema(selectedDatabase.id, selectedSchema.name);
      const table = tables.find((t) => t.id === tableId);
      const fullTableId = `${selectedDatabase.id}.${selectedSchema.name}.${tableId}`;
      onTableSelect(fullTableId, table?.name ?? tableId);
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
          />
        </div>
        <div className="px-2 pb-2">
          <NavButtons activeId={activeNavId} onSelect={handleNavSelect} />
        </div>
      </div>

      {/* Database selector */}
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
          className="w-full h-8 px-2 text-xs bg-background border border-sidebar-border rounded-md text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {MOCK_DATABASES.map(db => (
            <option key={db.id} value={db.id}>
              {db.name} ({db.type})
            </option>
          ))}
        </select>
      </div>

      {/* Schema and search section */}
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

      {/* Table list */}
      <ScrollArea className="flex-1">
        <TableList
          tables={filteredTables}
          activeTableId={activeTableId}
          selectedTableIds={selectedTableIds}
          isMultiSelectMode={isMultiSelectMode}
          activeSortingTableIds={["categories"]}
          editingTableId={editingTableId}
          onTableSelect={handleTableSelect}
          onTableMultiSelect={handleTableMultiSelect}
          onContextAction={handleContextAction}
          onRightClickAction={handleRightClickAction}
          onTableRename={handleTableRename}
        />
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
