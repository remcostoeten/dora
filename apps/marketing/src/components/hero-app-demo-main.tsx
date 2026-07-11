"use client";

import {
  ArrowUp,
  ArrowUpDown,
  Ban,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  Copy,
  CopyPlus,
  Download,
  Edit3,
  FileJson,
  Filter,
  Minus,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Table as TableIcon,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DatabaseTypeIcon } from "@studio/features/connections/components/database-type-icon";
import { noop } from "@/shared/lib/noop";
import {
  connectionStatusColor,
  findConnection,
} from "@/components/hero-app-demo-connections";
import {
  type TDemoColumn,
  type TDemoTable,
  findTable,
  gridTemplate,
} from "@/components/hero-app-demo-tables";

/**
 * Static replica of the real /app main panel (connection tabs, table tabs,
 * studio toolbar, data grid, status bar). Class strings are copied from the
 * studio components (tab-bar, window-controls, studio-toolbar, data-grid,
 * bottom-status-bar).
 */

function GridCheckbox({
  active,
  onClick,
}: {
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center border-b border-r border-sidebar-border bg-background transition-colors hover:bg-sidebar-accent/50"
    >
      <span
        className={
          "h-3.5 w-3.5 rounded-[2px] border transition-colors " +
          (active
            ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--background)]"
            : "border-muted-foreground/40")
        }
      />
    </button>
  );
}

function renderHead(
  column: TDemoColumn,
  activeSort: string,
  onSort: (name: string) => void,
) {
  const active = column.name === activeSort;

  function sortColumn() {
    onSort(column.name);
  }

  return (
    <button
      type="button"
      key={column.name}
      onClick={sortColumn}
      className={
        "group/head flex h-9 items-center gap-1.5 overflow-hidden border-b border-r border-sidebar-border bg-sidebar-accent/50 px-3 text-left transition-colors hover:bg-sidebar-accent " +
        (active ? "bg-sidebar-accent/60" : "")
      }
    >
      <span className="text-foreground text-xs font-medium font-sans shrink-0">
        {column.name}
      </span>
      <span className="text-muted-foreground/50 text-[10px] font-mono lowercase truncate">
        {column.type}
      </span>
      {active ? (
        <ArrowUp className="ml-auto h-3 w-3 shrink-0 self-center text-primary" />
      ) : (
        <ArrowUpDown className="ml-auto h-3 w-3 shrink-0 self-center text-muted-foreground/50 opacity-0 transition-opacity group-hover/head:opacity-100" />
      )}
    </button>
  );
}

function cellTone(column: TDemoColumn, cell: string): string {
  if (!cell) return "italic text-muted-foreground/60";
  if (column.kind === "pk") return "text-right text-primary/80 tabular-nums";
  if (column.kind === "fk") return "text-blue-400/80 tabular-nums";
  if (
    column.kind === "number" ||
    column.kind === "money" ||
    column.kind === "date"
  )
    return "text-foreground/90 tabular-nums";
  return "text-foreground/90";
}

function TableRow({
  row,
  rowIndex,
  columns,
  template,
  selectedRows,
  selectedCell,
  editingCell,
  stagedCells,
  deletingRows,
  onRowSelect,
  onCellSelect,
  onEditStart,
  onEditCommit,
  onEditCancel,
}: {
  row: string[];
  rowIndex: number;
  columns: TDemoColumn[];
  template: string;
  selectedRows: string[];
  selectedCell: string;
  editingCell: string | null;
  stagedCells: string[];
  deletingRows: Map<string, number>;
  onRowSelect: (id: string) => void;
  onCellSelect: (cell: string) => void;
  onEditStart: (cell: string) => void;
  onEditCommit: (cell: string, value: string) => void;
  onEditCancel: () => void;
}) {
  const rowSelected = selectedRows.includes(row[0]);
  const isDeleting = deletingRows.has(row[0]);
  const deleteIndex = deletingRows.get(row[0]) ?? -1;

  function renderCell(cell: string, cellIndex: number) {
    const column = columns[cellIndex];
    const cellId = row[0] + ":" + cellIndex;
    const editable = column.kind !== "pk";

    if (editingCell === cellId)
      return (
        <div
          key={column.name}
          className="relative border-b border-r border-sidebar-border bg-background"
        >
          <input
            autoFocus
            defaultValue={cell}
            onFocus={(event) => event.target.select()}
            onBlur={(event) => {
              if (event.target.dataset.cancelled) {
                onEditCancel();
                return;
              }
              onEditCommit(cellId, event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.dataset.cancelled = "1";
                event.currentTarget.blur();
              }
            }}
            className="h-full w-full bg-transparent px-3 py-1.5 text-left text-foreground outline-none ring-1 ring-inset ring-primary/60"
          />
        </div>
      );

    const isStaged = stagedCells.includes(cellId);
    const focused = selectedCell === cellId;
    const staged = isStaged
      ? " relative bg-amber-500/10 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.4)]"
      : "";
    const focus =
      focused && !isStaged
        ? " relative bg-sidebar-accent/35 shadow-[inset_0_0_0_1px_hsl(0_0%_86%/0.35)]"
        : "";
    const base =
      "overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-sidebar-border px-3 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50 ";

    function selectCell() {
      onCellSelect(cellId);
    }

    function startEdit() {
      if (editable) onEditStart(cellId);
    }

    let content: ReactNode = cell || "NULL";
    if (cell && column.kind === "date") {
      const [datePart, timePart] = cell.split(" ");
      content = (
        <>
          {datePart}{" "}
          {timePart && (
            <span className="text-muted-foreground/60">{timePart}</span>
          )}
        </>
      );
    }

    return (
      <button
        type="button"
        key={column.name}
        onClick={selectCell}
        onDoubleClick={startEdit}
        title={editable ? "Double-click to edit" : undefined}
        className={base + cellTone(column, cell) + focus + staged}
      >
        {content}
      </button>
    );
  }

  function selectRow() {
    onRowSelect(row[0]);
  }

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        x: 48,
        scaleY: 0.82,
        filter: "blur(8px)",
        height: 0,
        overflow: "hidden",
        transition: {
          duration: 0.26,
          ease: [0.23, 1, 0.32, 1],
          delay: deleteIndex >= 0 ? deleteIndex * 0.065 : 0,
        },
      }}
      transition={{
        default: {
          type: "spring",
          duration: 0.4,
          bounce: 0.22,
        },
        layout: { type: "spring", duration: 0.35, bounce: 0.15 },
      }}
      style={{ gridTemplateColumns: template }}
      className={
        "group relative grid " +
        (rowSelected
          ? "bg-primary/10"
          : (rowIndex % 2 === 1 ? "bg-muted/35 " : "") +
            "hover:bg-sidebar-accent/30")
      }
    >
      <AnimatePresence>
        {isDeleting && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.08 }}
            className="pointer-events-none absolute inset-0 z-10 bg-red-500/10 ring-1 ring-inset ring-red-500/20"
          />
        )}
      </AnimatePresence>
      <GridCheckbox active={rowSelected} onClick={selectRow} />
      {row.map(renderCell)}
    </m.div>
  );
}

function WindowControls() {
  return (
    <div className="flex h-full shrink-0 items-center border-l border-border px-1">
      <div className="flex items-center gap-0.5 text-sidebar-foreground/75">
        <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted">
          <Minus className="h-3.5 w-3.5" />
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted">
          <Square className="h-3 w-3" />
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-destructive/90 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

/** Replica of the real ConnectionTabBar: one h-8 tab per open connection, a
 *  status dot, a close affordance and a trailing add button. It stacks above
 *  the table tab bar and owns the window controls, exactly like /app. */
function ConnectionTabBar({
  openConnectionIds,
  activeConnectionId,
  onSelectConnection,
  onCloseConnection,
  onAddConnection,
}: {
  openConnectionIds: string[];
  activeConnectionId: string;
  onSelectConnection: (id: string) => void;
  onCloseConnection: (id: string) => void;
  onAddConnection: () => void;
}) {
  return (
    <div className="flex items-center h-8 border-b border-border bg-sidebar shrink-0 select-none">
      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hero-tab-scroll">
        {openConnectionIds.map(function renderConnectionTab(id) {
          const connection = findConnection(id);
          const isActive = id === activeConnectionId;

          function selectConnection() {
            onSelectConnection(id);
          }

          function closeConnection(event: React.MouseEvent) {
            event.stopPropagation();
            onCloseConnection(id);
          }

          return (
            <div
              key={id}
              className={
                "relative flex items-center h-full shrink-0 border-r border-border transition-colors " +
                (isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50")
              }
            >
              <button
                type="button"
                onClick={selectConnection}
                className="flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium"
              >
                <span
                  aria-hidden="true"
                  className={
                    "h-2 w-2 shrink-0 rounded-full " +
                    connectionStatusColor(connection.status)
                  }
                />
                <DatabaseTypeIcon
                  type={connection.type}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="max-w-[140px] truncate">
                  {connection.name}
                </span>
              </button>
              <button
                type="button"
                onClick={closeConnection}
                aria-label={`Close ${connection.name}`}
                className="h-full px-1 pr-2 rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAddConnection}
          aria-label="Add connection"
          className="flex items-center justify-center h-full px-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <WindowControls />
    </div>
  );
}

/** One h-9 tab per open table, mirroring the real app's table tab strip. */
function TableTabBar({
  openTables,
  activeTable,
  onSelectTable,
  onCloseTable,
}: {
  openTables: string[];
  activeTable: string;
  onSelectTable: (name: string) => void;
  onCloseTable: (name: string) => void;
}) {
  return (
    <div className="flex items-center h-9 border-b border-border bg-sidebar shrink-0 select-none">
      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hero-tab-scroll">
        {openTables.map(function renderTableTab(name) {
          const isActive = name === activeTable;

          function selectTable() {
            onSelectTable(name);
          }

          function closeTable(event: React.MouseEvent) {
            event.stopPropagation();
            onCloseTable(name);
          }

          return (
            <div
              key={name}
              className={
                "relative flex items-center h-full shrink-0 border-r border-border transition-colors " +
                (isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50")
              }
            >
              <button
                type="button"
                onClick={selectTable}
                className="flex items-center h-full px-2 pl-3 text-xs font-medium"
              >
                <span className="max-w-[120px] truncate">{name}</span>
              </button>
              <button
                type="button"
                onClick={closeTable}
                aria-label={`Close ${name}`}
                className="h-full flex items-center px-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GhostButton({
  icon: Icon,
  label,
  iconClass,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  iconClass?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-6 items-center gap-1.5 rounded-[2px] px-1.5 text-[11px] whitespace-nowrap transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground " +
        (active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground")
      }
    >
      <Icon
        className={"h-3.5 w-3.5 shrink-0 opacity-90 " + (iconClass ?? "")}
      />
      <span>{label}</span>
    </button>
  );
}

function ShortcutBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="ml-1 hidden lg:inline-flex h-4.5 min-w-[20px] items-center justify-center rounded-md border border-border/60 bg-muted/40 px-1 font-sans text-[9px] font-medium text-muted-foreground/80 tracking-tight"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function BarButton({
  icon: Icon,
  label,
  shortcut,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  tone?: "muted" | "destructive";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive bg-destructive/[0.08] hover:bg-destructive/[0.15] dark:text-red-400"
      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium h-7 px-2.5 shrink-0 transition-[color,background-color,transform] duration-150 active:scale-[0.97] " +
        toneClass
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
      {shortcut && <ShortcutBadge>{shortcut}</ShortcutBadge>}
    </button>
  );
}

/** Synthesises a plausible new record for `table` from its column kinds, so
 *  "Add record" produces a row that fits the schema rather than a customer. */
function draftRecord(table: TDemoTable, id: string): string[] {
  return table.columns.map(function draftCell(column, index) {
    if (index === 0) return id;
    if (column.kind === "fk") return String((Number(id) % 12) + 1);
    if (column.kind === "money") return "0.00";
    if (column.kind === "number") return "0";
    if (column.kind === "date")
      return column.type === "date"
        ? "2026-04-01"
        : "2026-04-01 12:00:00";
    return "draft_" + id;
  });
}

/** Everything below the table tabs. Remounted per table (keyed on the table
 *  name) so rows, selection and sort start clean for each schema. */
function TableWorkspace({ table }: { table: TDemoTable }) {
  const [sourceRows, setSourceRows] = useState(table.rows);
  const [selectedRows, setSelectedRows] = useState<string[]>(["1"]);
  const [selectedCell, setSelectedCell] = useState("1:1");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [stagedCells, setStagedCells] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeSort, setActiveSort] = useState("id");
  const [dryEdit, setDryEdit] = useState(false);
  const [jsonView, setJsonView] = useState(false);
  const [filterOn, setFilterOn] = useState(false);
  const [queryMs, setQueryMs] = useState(3);
  const [deletingRows, setDeletingRows] = useState<Map<string, number>>(
    new Map(),
  );

  const template = gridTemplate(table);

  const displayRows = useMemo(
    function getRows() {
      const filteredRows = filterOn
        ? sourceRows.filter(function filterRow(row) {
            return row
              .join(" ")
              .toLowerCase()
              .includes(table.filterToken.toLowerCase());
          })
        : sourceRows;
      const sortIndex = table.columns.findIndex(function findColumn(column) {
        return column.name === activeSort;
      });
      if (sortIndex < 0) return filteredRows;
      return filteredRows.toSorted(function sortRows(a, b) {
        return a[sortIndex].localeCompare(b[sortIndex], undefined, {
          numeric: true,
        });
      });
    },
    [activeSort, filterOn, sourceRows, table],
  );

  function toggleRow(id: string) {
    setSelectedRows(function updateSelected(current) {
      if (current.includes(id))
        return current.filter(function remove(rowId) {
          return rowId !== id;
        });
      return current.concat(id);
    });
  }

  function toggleAllRows() {
    setSelectedRows(function updateSelected(current) {
      if (current.length === displayRows.length) return [];
      return displayRows.map(function mapId(row) {
        return row[0];
      });
    });
  }

  function maxId(rows: string[][]): number {
    return rows.reduce(
      (max, row) => Math.max(max, Number(row[0]) || 0),
      0,
    );
  }

  function addRecord() {
    setSourceRows(function addRow(current) {
      return current.concat([
        draftRecord(table, String(maxId(current) + 1)),
      ]);
    });
    setQueryMs(5);
  }

  function duplicateSelected() {
    setSourceRows(function cloneRows(current) {
      let nextId = maxId(current);
      const clones = current
        .filter((row) => selectedRows.includes(row[0]))
        .map((row) => {
          nextId += 1;
          return [String(nextId), ...row.slice(1)];
        });
      return current.concat(clones);
    });
    setQueryMs(5);
  }

  function copySelected() {
    const records = sourceRows
      .filter((row) => selectedRows.includes(row[0]))
      .map((row) =>
        Object.fromEntries(
          table.columns.map((column, index) => [
            column.name,
            row[index] || null,
          ]),
        ),
      );
    navigator.clipboard
      .writeText(JSON.stringify(records, null, 2))
      .catch(noop);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function startEdit(cell: string) {
    setEditingCell(cell);
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  function commitEdit(cell: string, value: string) {
    const [rowId, columnIndex] = cell.split(":");
    setSourceRows(function updateRows(current) {
      return current.map((row) =>
        row[0] === rowId
          ? row.map((rowCell, index) =>
              index === Number(columnIndex) ? value : rowCell,
            )
          : row,
      );
    });
    if (dryEdit)
      setStagedCells((cells) =>
        cells.includes(cell) ? cells : cells.concat(cell),
      );
    setEditingCell(null);
    setSelectedCell(cell);
    setQueryMs(6);
  }

  function resetData() {
    setSourceRows(table.rows);
    setSelectedRows([]);
    setSelectedCell("1:1");
    setEditingCell(null);
    setStagedCells([]);
    setQueryMs(2);
  }

  function deleteSelected() {
    const deleteMap = new Map(
      selectedRows.map(function mapOrder(id, i) {
        return [id, i] as [string, number];
      }),
    );
    setDeletingRows(deleteMap);
    setTimeout(function commitDelete() {
      setSourceRows(function removeRows(current) {
        return current.filter(function keepRow(row) {
          return !deleteMap.has(row[0]);
        });
      });
      setSelectedRows([]);
      setQueryMs(4);
    }, 170);
    setTimeout(function clearDeleting() {
      setDeletingRows(new Map());
    }, 1100);
  }

  function clearSelection() {
    setSelectedRows([]);
  }

  function refreshData() {
    resetData();
  }

  function toggleDryEdit() {
    if (dryEdit) setStagedCells([]);
    setDryEdit(!dryEdit);
  }

  function toggleJsonView() {
    setJsonView(function toggle(value) {
      return !value;
    });
  }

  function toggleFilter() {
    setFilterOn(function toggle(value) {
      return !value;
    });
  }

  function selectCell(cell: string) {
    setSelectedCell(cell);
  }

  function sortColumn(name: string) {
    setActiveSort(name);
    setQueryMs(4);
  }

  return (
    <>
      {/* Studio toolbar */}
      <div className="flex items-center h-10 pl-2 pr-2 gap-2 text-sm bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-1 mr-1 pl-2">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <div className="flex items-center bg-sidebar-accent/50 rounded-md p-0.5">
            <button
              type="button"
              onClick={function showTableView() {
                setJsonView(false);
              }}
              className={
                "flex h-6 w-6 items-center justify-center rounded-sm transition-colors " +
                (!jsonView
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                  : "text-muted-foreground hover:text-sidebar-foreground")
              }
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleJsonView}
              className={
                "flex h-6 w-6 items-center justify-center rounded-sm transition-colors " +
                (jsonView
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                  : "text-muted-foreground hover:text-sidebar-foreground")
              }
            >
              <FileJson className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-sidebar-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <button
            type="button"
            onClick={toggleFilter}
            className={
              "inline-flex h-6 items-center gap-1.5 rounded-[2px] px-1.5 text-[11px] whitespace-nowrap transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground " +
              (filterOn
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-muted-foreground")
            }
          >
            <Filter className="h-3.5 w-3.5 shrink-0 opacity-90" />
            <span>Filters</span>
            {filterOn && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold tabular-nums text-primary-foreground">
                1
              </span>
            )}
          </button>
          <GhostButton icon={Columns3} label="Columns" />
          <button
            type="button"
            onClick={toggleDryEdit}
            className={
              "inline-flex h-6 items-center gap-1.5 rounded-[2px] px-1.5 text-[11px] whitespace-nowrap transition-colors " +
              (dryEdit
                ? "bg-amber-500/20 text-amber-500"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground")
            }
          >
            <Edit3 className="h-3.5 w-3.5 shrink-0 opacity-90" />
            <span>Dry-Edit</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <button
            type="button"
            onClick={addRecord}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] text-[11px] font-medium bg-primary text-primary-foreground mr-1 whitespace-nowrap transition-opacity hover:opacity-85"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Add record</span>
          </button>
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <button
            type="button"
            onClick={refreshData}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="w-full text-sm font-mono">
          {!jsonView && (
            <div
              style={{ gridTemplateColumns: template }}
              className="grid bg-sidebar"
            >
              <GridCheckbox
                active={selectedRows.length === displayRows.length}
                onClick={toggleAllRows}
              />
              {table.columns.map(function mapHead(column) {
                return renderHead(column, activeSort, sortColumn);
              })}
            </div>
          )}
          {jsonView ? (
            <pre className="m-0 h-full min-h-80 overflow-hidden bg-background px-4 py-3 text-xs leading-relaxed">
              <JsonDocument
                columns={table.columns}
                rows={displayRows.slice(0, 6)}
              />
            </pre>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {displayRows.map(function mapRow(row, rowIndex) {
                return (
                  <TableRow
                    key={row[0]}
                    row={row}
                    rowIndex={rowIndex}
                    columns={table.columns}
                    template={template}
                    selectedRows={selectedRows}
                    selectedCell={selectedCell}
                    editingCell={editingCell}
                    stagedCells={stagedCells}
                    deletingRows={deletingRows}
                    onRowSelect={toggleRow}
                    onCellSelect={selectCell}
                    onEditStart={startEdit}
                    onEditCommit={commitEdit}
                    onEditCancel={cancelEdit}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRows.length > 0 && (
          <m.div
            layout
            transition={{
              type: "spring",
              stiffness: 440,
              damping: 36,
              mass: 0.7,
            }}
            role="toolbar"
            className="flex items-center gap-2 h-11 px-3 bg-sidebar/80 backdrop-blur-sm border-t border-sidebar-border shrink-0 animate-in slide-in-from-bottom-2 duration-200 outline-none"
          >
            <div className="flex items-center gap-2 shrink-0 pr-1">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-semibold tabular-nums px-1.5">
                {selectedRows.length}
              </span>
              <span className="text-sm text-foreground/70">
                row{selectedRows.length !== 1 ? "s" : ""} selected
              </span>
            </div>

            <div
              className="h-5 w-px bg-border/60 shrink-0"
              aria-hidden="true"
            />

            <div className="flex items-center gap-0.5">
              <BarButton
                icon={Copy}
                label={copied ? "Copied" : "Copy"}
                shortcut="C"
                onClick={copySelected}
              />
              <BarButton
                icon={CopyPlus}
                label="Duplicate"
                onClick={duplicateSelected}
              />
              <BarButton icon={Download} label="Export" />
              <BarButton icon={Pencil} label="Edit" />
              <BarButton icon={Ban} label="Set NULL" />
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <BarButton
                icon={Trash2}
                label="Delete"
                shortcut="Del"
                tone="destructive"
                onClick={deleteSelected}
              />
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="inline-flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-muted-foreground transition-[color,background-color,transform] duration-150 active:scale-[0.97] hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between h-10 px-3 bg-sidebar border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live · 5s
          </span>
          <div className="h-3 w-px bg-sidebar-border" />
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {queryMs}ms
          </span>
          <div className="h-3 w-px bg-sidebar-border" />
          <span>
            Showing 1-{displayRows.length} of {displayRows.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Limit:</span>
            <span className="flex items-center justify-center h-6 w-16 rounded-[2px] border border-input text-center tabular-nums">
              50
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Offset:</span>
            <span className="flex items-center justify-center h-6 w-16 rounded-[2px] border border-input text-center tabular-nums">
              0
            </span>
          </span>
          <span className="text-muted-foreground">Page 1 of 1</span>
          <div className="flex items-center rounded-[2px] border border-input">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

type TMainProps = {
  activeTable: string;
  openTables: string[];
  openConnectionIds: string[];
  activeConnectionId: string;
  onSelectTable: (name: string) => void;
  onCloseTable: (name: string) => void;
  onSelectConnection: (id: string) => void;
  onCloseConnection: (id: string) => void;
  onAddConnection: () => void;
};

export function DemoMain({
  activeTable,
  openTables,
  openConnectionIds,
  activeConnectionId,
  onSelectTable,
  onCloseTable,
  onSelectConnection,
  onCloseConnection,
  onAddConnection,
}: TMainProps) {
  const table = findTable(activeTable);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div
        className="hero-app-demo__fade hero-app-demo__fade--main"
        aria-hidden="true"
      />
      <ConnectionTabBar
        openConnectionIds={openConnectionIds}
        activeConnectionId={activeConnectionId}
        onSelectConnection={onSelectConnection}
        onCloseConnection={onCloseConnection}
        onAddConnection={onAddConnection}
      />

      <TableTabBar
        openTables={openTables}
        activeTable={activeTable}
        onSelectTable={onSelectTable}
        onCloseTable={onCloseTable}
      />

      <TableWorkspace key={table.name} table={table} />

      {/* Floating AI assistant button */}
      <button
        type="button"
        className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-sidebar-accent"
      >
        <Sparkles className="h-4 w-4 text-foreground" />
      </button>
    </main>
  );
}

/** Faked JSON syntax highlighting for the document view: keys/strings/numbers
 *  get their own tint so the toggle reads like a real code viewer. */
function JsonDocument({
  columns,
  rows,
}: {
  columns: TDemoColumn[];
  rows: string[][];
}) {
  const punct = "text-muted-foreground/70";

  function renderField(
    column: TDemoColumn,
    value: string,
    last: boolean,
  ) {
    const isNumber =
      column.kind === "pk" ||
      column.kind === "fk" ||
      column.kind === "number" ||
      column.kind === "money";
    return (
      <span key={column.name}>
        {"    "}
        <span className="text-syntax-key">&quot;{column.name}&quot;</span>
        <span className={punct}>: </span>
        {value === "" ? (
          <span className="italic text-muted-foreground/60">null</span>
        ) : isNumber ? (
          <span className="text-syntax-number">{value}</span>
        ) : (
          <span className="text-syntax-string">&quot;{value}&quot;</span>
        )}
        <span className={punct}>{last ? "" : ","}</span>
        {"\n"}
      </span>
    );
  }

  function renderRecord(row: string[], index: number) {
    return (
      <span key={row[0]}>
        {"  "}
        <span className={punct}>{"{"}</span>
        {"\n"}
        {columns.map(function mapField(column, columnIndex) {
          return renderField(
            column,
            row[columnIndex],
            columnIndex === columns.length - 1,
          );
        })}
        {"  "}
        <span className={punct}>
          {"}"}
          {index === rows.length - 1 ? "" : ","}
        </span>
        {"\n"}
      </span>
    );
  }

  return (
    <>
      <span className={punct}>[</span>
      {"\n"}
      {rows.map(renderRecord)}
      <span className={punct}>]</span>
    </>
  );
}
