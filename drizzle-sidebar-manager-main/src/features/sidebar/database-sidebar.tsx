import { useState, useMemo } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { SpotlightTrigger } from "./components/spotlight-trigger";
import { NavButtons } from "./components/nav-buttons";
import { SchemaSelector } from "./components/schema-selector";
import { TableSearch, FilterState } from "./components/table-search";
import { TableList } from "./components/table-list";
import { AddMenu, AddAction } from "./components/add-menu";
import { BottomToolbar, ToolbarAction } from "./components/bottom-toolbar";
import { SettingsPanel, SettingsState } from "./components/settings-panel";
import { ManageTablesDialog, BulkAction } from "./components/manage-tables-dialog";
import { MOCK_SCHEMAS, MOCK_TABLES } from "./data";
import { Schema, TableItem } from "./types";
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
};

export function DatabaseSidebar({
  activeNavId: controlledNavId,
  onNavSelect
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

  const [selectedSchema, setSelectedSchema] = useState<Schema>(MOCK_SCHEMAS[0]);
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeTableId, setActiveTableId] = useState<string | undefined>();
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  const filteredTables = useMemo(() => {
    return MOCK_TABLES.filter((table) => {
      if (searchValue && !table.name.toLowerCase().includes(searchValue.toLowerCase())) {
        return false;
      }

      if (table.type === "table" && !filters.showTables) return false;
      if (table.type === "view" && !filters.showViews) return false;
      if (table.type === "materialized-view" && !filters.showMaterializedViews) return false;

      return true;
    });
  }, [searchValue, filters]);

  function handleTableSelect(tableId: string) {
    setActiveTableId(tableId);
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
    setShowAddMenu(false);
    console.log("Add action:", action);
  }

  function handleContextAction(tableId: string, action: string) {
    console.log("Context action:", tableId, action);
  }

  function handleBulkAction(action: BulkAction) {
    console.log("Bulk action:", action, selectedTableIds);
    setSelectedTableIds([]);
    setIsMultiSelectMode(false);
  }

  function handleToolbarAction(action: ToolbarAction) {
    if (action === "settings") {
      setShowSettings(!showSettings);
    } else {
      console.log("Toolbar action:", action);
    }
  }

  function handleCopySchema() {
    console.log("Copy schema");
  }

  return (
    <div className="relative flex flex-col h-full w-[244px] bg-sidebar border-r border-sidebar-border">
      {/* Header section with spotlight and nav */}
      <div className="flex flex-col">
        <div className="px-3 pt-3 pb-2">
          <SpotlightTrigger onSpotlightOpen={() => console.log("Open spotlight")} />
        </div>
        <div className="px-2 pb-2">
          <NavButtons activeId={activeNavId} onSelect={handleNavSelect} />
        </div>
      </div>

      {/* Schema and search section */}
      <div className="flex flex-col gap-2 px-2 py-2 border-t border-sidebar-border">
        <SchemaSelector
          schemas={MOCK_SCHEMAS}
          selectedSchema={selectedSchema}
          onSchemaChange={setSelectedSchema}
        />

        <TableSearch
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={() => console.log("Refresh")}
          onAddClick={() => setShowAddMenu(true)}
        />

        <AddMenu
          open={showAddMenu}
          onOpenChange={setShowAddMenu}
          onAction={handleAddAction}
        >
          <Button className="hidden" />
        </AddMenu>
      </div>

      {/* Table list */}
      <ScrollArea className="flex-1">
        <TableList
          tables={filteredTables}
          activeTableId={activeTableId}
          selectedTableIds={selectedTableIds}
          isMultiSelectMode={isMultiSelectMode}
          activeSortingTableIds={["categories"]}
          onTableSelect={handleTableSelect}
          onTableMultiSelect={handleTableMultiSelect}
          onContextAction={handleContextAction}
        />
      </ScrollArea>

      {isMultiSelectMode && selectedTableIds.length > 0 && (
        <ManageTablesDialog
          selectedCount={selectedTableIds.length}
          onAction={handleBulkAction}
          onClose={() => {
            setIsMultiSelectMode(false);
            setSelectedTableIds([]);
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onCopySchema={handleCopySchema}
        />
      )}

      <BottomToolbar onAction={handleToolbarAction} />
    </div>
  );
}
