import { useRef, useState, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortConfig } from "../../types";

type Props = {
  columnName: string;
  dataType: string;
  width: number;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  onResize: (column: string, width: number) => void;
  onDoubleClickResize: (column: string) => void;
};

export function ResizableColumnHeader({
  columnName,
  dataType,
  width,
  sortConfig,
  onSort,
  onResize,
  onDoubleClickResize,
}: Props) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  function renderSortIcon() {
    if (sortConfig?.column !== columnName) {
      return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-3 w-3 text-primary" />;
    }
    return <ArrowDown className="h-3 w-3 text-primary" />;
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    function handleMouseMove(moveEvent: MouseEvent) {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      onResize(columnName, newWidth);
    }

    function handleMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDoubleClickResize(columnName);
  }

  return (
    <div
      ref={headerRef}
      className="group relative flex h-9 shrink-0 cursor-pointer items-center justify-between gap-2 border-r border-table-border bg-table-header px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-table-row-hover"
      style={{ width: `${width}px` }}
      onClick={() => onSort(columnName)}
    >
      <div className="flex items-center gap-1 overflow-hidden">
        <span className="truncate font-mono">{columnName}</span>
        <span className="shrink-0 text-muted-foreground/60">{dataType}</span>
      </div>
      {renderSortIcon()}
      <div
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 ${
          isResizing ? "bg-primary" : ""
        }`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
