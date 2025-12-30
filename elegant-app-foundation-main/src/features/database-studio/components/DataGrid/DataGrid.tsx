import { Plus } from "lucide-react";
import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { EditableCell } from "./EditableCell";
import { ResizableColumnHeader } from "./ResizableColumnHeader";
import type { ColumnInfo, TableRow, SortConfig } from "../../types";

type Props = {
  columns: ColumnInfo[];
  rows: TableRow[];
  selectedRows: Set<string>;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  onRowClick: (rowIndex: number, rowId: string, event: React.MouseEvent) => void;
  onToggleRow: (rowId: string) => void;
  onSelectAllRows: (checked: boolean) => void;
  onCellClick: (rowId: string, column: string, event: React.MouseEvent) => void;
  onCellDoubleClick: (rowId: string, column: string) => void;
  onFinishCellEdit: (rowId: string, column: string) => void;
  isCellEditing: (rowId: string, column: string) => boolean;
  isCellSelected: (rowId: string, column: string) => boolean;
  onCellEdit: (rowId: string, column: string, value: string, originalValue: unknown) => void;
  getDraftValue: (rowId: string, column: string) => string | null;
  onColumnResize: (column: string, width: number) => void;
  onColumnDoubleClickResize: (column: string) => void;
  getColumnWidth: (column: string) => number;
};

export function DataGrid({
  columns,
  rows,
  selectedRows,
  sortConfig,
  onSort,
  onRowClick,
  onToggleRow,
  onSelectAllRows,
  onCellClick,
  onCellDoubleClick,
  onFinishCellEdit,
  isCellEditing,
  isCellSelected,
  onCellEdit,
  getDraftValue,
  onColumnResize,
  onColumnDoubleClickResize,
  getColumnWidth,
}: Props) {
  const allSelected = rows.length > 0 && selectedRows.size === rows.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length;

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-table-border bg-table-header">
          <div className="flex">
            <div className="flex h-9 w-10 items-center justify-center border-r border-table-border">
              <Checkbox
                checked={false}
                onCheckedChange={() => {}}
                disabled
              />
            </div>
            {columns.map((col) => (
              <ResizableColumnHeader
                key={col.name}
                columnName={col.name}
                dataType={col.dataType}
                width={getColumnWidth(col.name)}
                sortConfig={sortConfig}
                onSort={onSort}
                onResize={onColumnResize}
                onDoubleClickResize={onColumnDoubleClickResize}
              />
            ))}
            <div className="flex h-9 w-10 items-center justify-center border-r border-table-border">
              <Plus className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-sm text-muted-foreground">
            <p>No rows</p>
            <p className="font-mono text-xs">limit 50 offset 0</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-table-border bg-table-header">
        <div className="flex">
          <div className="flex h-9 w-10 shrink-0 items-center justify-center border-r border-table-border">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(c) => onSelectAllRows(Boolean(c))}
              className={someSelected ? "data-[state=checked]:bg-primary" : ""}
            />
          </div>
          {columns.map((col) => (
            <ResizableColumnHeader
              key={col.name}
              columnName={col.name}
              dataType={col.dataType}
              width={getColumnWidth(col.name)}
              sortConfig={sortConfig}
              onSort={onSort}
              onResize={onColumnResize}
              onDoubleClickResize={onColumnDoubleClickResize}
            />
          ))}
          <div className="flex h-9 w-10 shrink-0 items-center justify-center border-r border-table-border">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          {rows.map((row, index) => {
            const rowId = String(row.id ?? `new-${index}`);
            const isSelected = selectedRows.has(rowId);
            const isNewRow = String(row.id).startsWith("new-");
            return (
              <div
                key={rowId}
                className={`flex border-b border-table-border transition-colors ${
                  isNewRow ? "bg-warning/5" : isSelected ? "bg-table-row-selected" : "hover:bg-table-row-hover"
                }`}
                onClick={(e) => onRowClick(index, rowId, e)}
              >
                <div
                  className="flex h-9 w-10 shrink-0 items-center justify-center border-r border-table-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleRow(rowId)}
                  />
                </div>
                {columns.map((col) => {
                  const isEditing = isCellEditing(rowId, col.name);
                  const isSelected = isCellSelected(rowId, col.name);
                  const width = getColumnWidth(col.name);
                  return (
                    <div
                      key={col.name}
                      className={`flex h-9 shrink-0 cursor-text items-center border-r border-table-border px-3 transition-colors ${
                        isSelected && !isEditing
                          ? "bg-primary/10 outline outline-2 outline-primary/40"
                          : ""
                      } ${isEditing ? "bg-background outline outline-2 outline-primary" : ""}`}
                      style={{ width: `${width}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCellClick(rowId, col.name, e);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onCellDoubleClick(rowId, col.name);
                      }}
                    >
                      <EditableCell
                        value={row[col.name]}
                        draftValue={getDraftValue(rowId, col.name)}
                        isEditing={isEditing}
                        onFinishEdit={() => onFinishCellEdit(rowId, col.name)}
                        onEdit={(value) => onCellEdit(rowId, col.name, value, row[col.name])}
                      />
                    </div>
                  );
                })}
                <div className="flex h-9 w-10 shrink-0 items-center justify-center border-r border-table-border" />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}