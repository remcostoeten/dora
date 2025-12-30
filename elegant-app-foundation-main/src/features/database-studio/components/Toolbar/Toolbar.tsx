import { Table2, Grid, List, RotateCcw, Filter as FilterIcon, Columns, Plus, ChevronLeft, ChevronRight, X, RefreshCw, Save, Undo } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import type { ColumnInfo, FilterCondition } from "../../types";

type Props = {
  tableName: string;
  columns: ColumnInfo[];
  visibleColumns: string[];
  filters: FilterCondition[];
  rowCount: number;
  currentOffset: number;
  limit: number;
  queryTime: string;
  hasDrafts: boolean;
  draftCount: number;
  onToggleColumn: (column: string) => void;
  onToggleAllColumns: (checked: boolean) => void;
  onAddFilter: () => void;
  onRemoveFilter: (id: string) => void;
  onUpdateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  onAddRecord: () => void;
  onRefresh: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSaveDrafts: () => void;
  onDiscardDrafts: () => void;
};

export function Toolbar({
  tableName,
  columns,
  visibleColumns,
  filters,
  rowCount,
  currentOffset,
  limit,
  queryTime,
  hasDrafts,
  draftCount,
  onToggleColumn,
  onToggleAllColumns,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onAddRecord,
  onRefresh,
  onPrevPage,
  onNextPage,
  onSaveDrafts,
  onDiscardDrafts,
}: Props) {
  const allColumnsVisible = visibleColumns.length === 0;

  function isColumnVisible(col: string) {
    if (visibleColumns.length === 0) return true;
    return visibleColumns.includes(col);
  }

  return (
    <div className="flex flex-col border-b border-border bg-card">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Table2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Grid className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <List className="h-4 w-4" />
        </Button>

        <div className="mx-2 h-4 w-px bg-border" />

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onRefresh}>
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="mx-2 h-4 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-3 text-muted-foreground">
              <FilterIcon className="h-4 w-4" />
              <span className="text-sm">Filters</span>
              {filters.length > 0 && (
                <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">{filters.length}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="flex flex-col gap-2">
              {filters.map((filter) => (
                <div key={filter.id} className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveFilter(filter.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                  <select
                    className="h-7 rounded bg-secondary px-2 text-xs"
                    value={filter.column}
                    onChange={(e) => onUpdateFilter(filter.id, { column: e.target.value })}
                  >
                    {columns.map((col) => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                  <select
                    className="h-7 rounded bg-secondary px-2 text-xs"
                    value={filter.operator}
                    onChange={(e) => onUpdateFilter(filter.id, { operator: e.target.value as FilterCondition["operator"] })}
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                    <option value="gt">{">"}</option>
                    <option value="lt">{"<"}</option>
                  </select>
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={filter.value}
                    onChange={(e) => onUpdateFilter(filter.id, { value: e.target.value })}
                    placeholder="Value"
                  />
                </div>
              ))}
              <Button variant="ghost" className="h-7 justify-start gap-1" onClick={onAddFilter}>
                <Plus className="h-3 w-3" />
                Add filter
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-3 text-muted-foreground">
              <Columns className="h-4 w-4" />
              <span className="text-sm">Columns</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Toggle columns</span>
              <Button
                variant="ghost"
                className="h-auto p-0 text-xs text-primary hover:bg-transparent"
                onClick={() => onToggleAllColumns(!allColumnsVisible)}
              >
                {allColumnsVisible ? "Deselect all" : "Select all"}
              </Button>
            </div>
            <Input placeholder="Search..." className="mb-2 h-7 text-xs" />
            <ScrollArea className="h-48">
              <div className="flex flex-col gap-0.5">
                {columns.map((col) => (
                  <label key={col.name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary">
                    <Checkbox
                      checked={isColumnVisible(col.name)}
                      onCheckedChange={() => onToggleColumn(col.name)}
                    />
                    {col.name}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Button variant="outline" className="h-8 gap-2 border-border px-3" onClick={onAddRecord}>
          <Plus className="h-4 w-4" />
          <span className="text-sm">Add record</span>
        </Button>

        {hasDrafts && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <div className="flex items-center gap-1 rounded bg-warning/10 px-2 py-1">
              <span className="text-xs text-warning">{draftCount} unsaved change{draftCount > 1 ? "s" : ""}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-warning hover:text-warning" onClick={onSaveDrafts}>
                <Save className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onDiscardDrafts}>
                <Undo className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{rowCount} rows • {queryTime}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPrevPage}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="font-mono">{limit}</span>
          <span className="font-mono">{currentOffset}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNextPage}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-2 py-1.5">
          {filters.map((filter, index) => (
            <div key={filter.id} className="flex items-center gap-1">
              {index === 0 && <span className="text-xs text-muted-foreground">where</span>}
              <select
                className="h-7 rounded bg-secondary px-2 text-xs"
                value={filter.column}
                onChange={(e) => onUpdateFilter(filter.id, { column: e.target.value })}
              >
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              <select
                className="h-7 rounded bg-secondary px-2 text-xs"
                value={filter.operator}
                onChange={(e) => onUpdateFilter(filter.id, { operator: e.target.value as FilterCondition["operator"] })}
              >
                <option value="equals">equals</option>
                <option value="contains">contains</option>
              </select>
              <Input
                className="h-7 w-32 text-xs"
                value={filter.value}
                onChange={(e) => onUpdateFilter(filter.id, { value: e.target.value })}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemoveFilter(filter.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" className="h-7 gap-1 text-xs" onClick={onAddFilter}>
            <Plus className="h-3 w-3" />
            Add filter
          </Button>
          <Button variant="ghost" className="ml-auto h-7 text-xs text-primary">
            Open in SQL
          </Button>
          <Button variant="ghost" className="h-7 text-xs">
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
