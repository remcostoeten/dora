import { useState } from "react";
import {
  Table2,
  MoreHorizontal,
  CornerDownRight,
  Eye,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { TableItem, SortedColumn } from "../types";
import { TableContextMenu } from "./table-context-menu";

function getTableIcon(type: TableItem["type"]) {
  switch (type) {
    case "view":
      return Eye;
    case "materialized-view":
      return Eye;
    default:
      return Table2;
  }
}

function formatRowCount(count: number | string): string {
  if (typeof count === "string") return count;
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 1 : 2).replace(/\.?0+$/, "")}K`;
  }
  return count.toString();
}

type TableItemRowProps = {
  item: TableItem;
  isSelected?: boolean;
  isActive?: boolean;
  isMultiSelectMode?: boolean;
  hasSorting?: boolean;
  onSelect?: () => void;
  onMultiSelect?: (checked: boolean) => void;
  onContextAction?: (action: string) => void;
};

function TableItemRow({
  item,
  isSelected,
  isActive,
  isMultiSelectMode,
  hasSorting,
  onSelect,
  onMultiSelect,
  onContextAction,
}: TableItemRowProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const Icon = getTableIcon(item.type);
  const hasSortedColumns = hasSorting && item.sortedColumns && item.sortedColumns.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors",
          isActive && "bg-sidebar-accent",
          !isActive && "hover:bg-sidebar-accent/60"
        )}
        onClick={onSelect}
      >
        {isMultiSelectMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onMultiSelect}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        )}

        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

        <span className="flex-1 text-sm text-sidebar-foreground truncate">
          {item.name}
        </span>



        {!showContextMenu && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 group-hover:hidden">
            {formatRowCount(item.rowCount)}
          </span>
        )}

        <TableContextMenu
          open={showContextMenu}
          onOpenChange={setShowContextMenu}
          onAction={(action) => onContextAction?.(action)}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-5 w-5 shrink-0 hidden group-hover:flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent",
              showContextMenu && "opacity-100 flex"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(true);
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </TableContextMenu>
      </div>

      {hasSortedColumns && (
        <div className="ml-4">
          {item.sortedColumns?.map((col) => (
            <SortedColumnRow key={col.id} column={col} />
          ))}
        </div>
      )}
    </div>
  );
}

type SortedColumnRowProps = {
  column: SortedColumn;
};

function SortedColumnRow({ column }: SortedColumnRowProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:bg-sidebar-accent/40 cursor-pointer transition-colors">
      <CornerDownRight className="h-3 w-3 shrink-0" />
      <span className="truncate">{column.name}</span>
    </div>
  );
}

type Props = {
  tables: TableItem[];
  activeTableId?: string;
  selectedTableIds?: string[];
  isMultiSelectMode?: boolean;
  activeSortingTableIds?: string[];
  onTableSelect?: (tableId: string) => void;
  onTableMultiSelect?: (tableId: string, checked: boolean) => void;
  onContextAction?: (tableId: string, action: string) => void;
};

export function TableList({
  tables,
  activeTableId,
  selectedTableIds = [],
  isMultiSelectMode = false,
  activeSortingTableIds = [],
  onTableSelect,
  onTableMultiSelect,
  onContextAction,
}: Props) {
  return (
    <div className="flex flex-col py-1">
      {tables.map((table) => (
        <TableItemRow
          key={table.id}
          item={table}
          isActive={activeTableId === table.id}
          isSelected={selectedTableIds.includes(table.id)}
          isMultiSelectMode={isMultiSelectMode}
          hasSorting={activeSortingTableIds.includes(table.id)}
          onSelect={() => onTableSelect?.(table.id)}
          onMultiSelect={(checked) => onTableMultiSelect?.(table.id, checked)}
          onContextAction={(action) => onContextAction?.(table.id, action)}
        />
      ))}
    </div>
  );
}
