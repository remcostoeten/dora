import { Search, Filter, Plus, RefreshCw, MoreHorizontal, Table2, Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Checkbox } from "@/shared/ui/checkbox";
import type { TableInfo } from "../../types";

type Props = {
  tables: TableInfo[];
  selectedTable: TableInfo | null;
  searchQuery: string;
  showTables: boolean;
  showViews: boolean;
  onSearchChange: (query: string) => void;
  onToggleTables: (show: boolean) => void;
  onToggleViews: (show: boolean) => void;
  onSelectTable: (table: TableInfo) => void;
  onRefresh: () => void;
  onAddTable: () => void;
  onBrowseData: (table: TableInfo) => void;
  onAlterTable: (table: TableInfo) => void;
  onTruncateTable: (table: TableInfo) => void;
  onDropTable: (table: TableInfo) => void;
};

export function Sidebar({
  tables,
  selectedTable,
  searchQuery,
  showTables,
  showViews,
  onSearchChange,
  onToggleTables,
  onToggleViews,
  onSelectTable,
  onRefresh,
  onAddTable,
  onBrowseData,
  onAlterTable,
  onTruncateTable,
  onDropTable,
}: Props) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <span className="text-sm">Spotlight...</span>
          <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">Ctrl+K</kbd>
        </Button>
        <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Table2 className="h-4 w-4" />
          <span className="text-sm">SQL console</span>
        </Button>
        <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Table2 className="h-4 w-4" />
          <span className="text-sm">Drizzle runner</span>
        </Button>
        <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Table2 className="h-4 w-4" />
          <span className="text-sm">Database studio</span>
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="h-8 bg-secondary pl-7 text-sm"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="start">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showTables} onCheckedChange={(c) => onToggleTables(Boolean(c))} />
                Show tables
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showViews} onCheckedChange={(c) => onToggleViews(Boolean(c))} />
                Show views
              </label>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onAddTable}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {tables.map((table) => (
            <div
              key={table.name}
              className={`group flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors ${
                selectedTable?.name === table.name
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => onSelectTable(table)}
              >
                {table.type === "view" ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Table2 className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="truncate font-mono text-xs">{table.name}</span>
              </button>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">{table.rowCount}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onBrowseData(table)}>
                      <Table2 className="mr-2 h-4 w-4" />
                      Browse data
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAlterTable(table)}>
                      <Table2 className="mr-2 h-4 w-4" />
                      Alter table
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onTruncateTable(table)} className="text-destructive">
                      Truncate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDropTable(table)} className="text-destructive">
                      Drop
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-1 border-t border-border p-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
