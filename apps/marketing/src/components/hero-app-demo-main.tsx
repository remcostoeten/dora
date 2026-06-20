"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  Download,
  Edit3,
  FileJson,
  Filter,
  Minus,
  PanelLeft,
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
import { useMemo, useState } from "react";

/**
 * Static replica of the real /app main panel (tab bar, studio toolbar, data grid,
 * status bar). Class strings are copied from the studio components (tab-bar,
 * window-controls, studio-toolbar, data-grid, bottom-status-bar).
 */

type TColumn = { name: string; type: string };

const columns: TColumn[] = [
  { name: "id", type: "serial" },
  { name: "name", type: "varchar(100)" },
  { name: "email", type: "varchar(255)" },
  { name: "phone", type: "varchar(20)" },
  { name: "city", type: "varchar(50)" },
  { name: "country", type: "varchar(50)" },
  { name: "created_at", type: "timestamp" },
];

const baseRows: string[][] = [
  [
    "1",
    "Emma Johnson",
    "emma.johnson@example.com",
    "+1-415-552-8841",
    "San Diego",
    "USA",
    "2025-11-04 09:12:48",
  ],
  [
    "2",
    "Liam Williams",
    "liam.williams@example.com",
    "+1-312-845-1190",
    "Chicago",
    "Canada",
    "2025-09-22 17:40:11",
  ],
  [
    "3",
    "Olivia Garcia",
    "olivia.garcia@example.com",
    "+1-602-771-3360",
    "Phoenix",
    "UK",
    "2026-01-15 11:03:27",
  ],
  [
    "4",
    "Noah Martinez",
    "noah.martinez@example.com",
    "+1-214-908-7725",
    "Dallas",
    "Germany",
    "2025-12-30 08:55:02",
  ],
  [
    "5",
    "Ava Davis",
    "ava.davis@example.com",
    "+1-718-334-2098",
    "New York",
    "France",
    "2025-10-18 22:14:39",
  ],
  [
    "6",
    "Elijah Wilson",
    "elijah.wilson@example.com",
    "+1-512-667-4410",
    "Austin",
    "Australia",
    "2026-02-09 14:27:50",
  ],
  [
    "7",
    "Sophia Brown",
    "sophia.brown@example.com",
    "+1-619-220-9913",
    "San Jose",
    "Netherlands",
    "2025-08-27 06:48:16",
  ],
  [
    "8",
    "James Miller",
    "james.miller@example.com",
    "+1-704-558-1276",
    "Charlotte",
    "Sweden",
    "2026-03-01 19:31:44",
  ],
  [
    "9",
    "Isabella Lopez",
    "isabella.lopez@example.com",
    "+1-215-870-6652",
    "Philadelphia",
    "USA",
    "2025-11-19 13:09:05",
  ],
  [
    "10",
    "Oliver Anderson",
    "oliver.anderson@example.com",
    "+1-832-441-3389",
    "Houston",
    "Norway",
    "2025-12-12 10:52:33",
  ],
];

const GRID_COLS = "grid-cols-[36px_60px_170px_236px_158px_126px_114px_180px]";

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
  column: TColumn,
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
        "flex items-baseline gap-1.5 overflow-hidden border-b border-r border-sidebar-border px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/45 " +
        (active ? "bg-sidebar-accent/60" : "")
      }
    >
      <span className="text-foreground text-xs font-sans shrink-0">
        {column.name}
      </span>
      <span className="text-muted-foreground/50 text-[10px] font-mono lowercase truncate">
        {column.type}
      </span>
    </button>
  );
}

function TableRow({
  row,
  selectedRows,
  selectedCell,
  deletingRows,
  onRowSelect,
  onCellSelect,
}: {
  row: string[];
  selectedRows: string[];
  selectedCell: string;
  deletingRows: Map<string, number>;
  onRowSelect: (id: string) => void;
  onCellSelect: (cell: string) => void;
}) {
  const rowSelected = selectedRows.includes(row[0]);
  const isDeleting = deletingRows.has(row[0]);
  const deleteIndex = deletingRows.get(row[0]) ?? -1;

  function renderCell(cell: string, cellIndex: number) {
    const cellId = row[0] + ":" + cellIndex;
    const focused = selectedCell === cellId;
    const tone =
      cellIndex === 0
        ? "text-muted-foreground tabular-nums"
        : "text-foreground/90";
    const focus = focused ? " relative ring-1 ring-inset ring-primary/70" : "";
    return (
      <button
        type="button"
        key={cellIndex}
        onClick={function selectCell() {
          onCellSelect(cellId);
        }}
        className={
          "overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-sidebar-border px-3 py-[9px] text-left transition-colors hover:bg-sidebar-accent/50 " +
          tone +
          focus
        }
      >
        {cell}
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
      className={
        "group relative grid " +
        GRID_COLS +
        " " +
        (rowSelected ? "bg-sidebar-accent/40" : "hover:bg-sidebar-accent/30")
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
        <span className="flex h-6 w-6 items-center justify-center rounded-[2px]">
          <Minus className="h-3.5 w-3.5" />
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-[2px]">
          <Square className="h-3 w-3" />
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-[2px]">
          <X className="h-3.5 w-3.5" />
        </span>
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

function makeCell(row: string[], cellIndex: number, table: string) {
  if (table === "customers") return row[cellIndex];
  if (cellIndex === 1) return table.slice(0, -1) + " " + row[0];
  if (cellIndex === 2) return table + "-" + row[0] + "@demo.local";
  if (cellIndex === 4) return row[4];
  return row[cellIndex];
}

function buildRows(table: string, sourceRows: string[][]) {
  return sourceRows.map(function mapRow(row) {
    return row.map(function mapCell(cell, cellIndex) {
      return makeCell(row, cellIndex, table) || cell;
    });
  });
}

export function DemoMain({ activeTable }: { activeTable: string }) {
  const [sourceRows, setSourceRows] = useState(baseRows);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState("1:1");
  const [activeSort, setActiveSort] = useState("id");
  const [dryEdit, setDryEdit] = useState(false);
  const [jsonView, setJsonView] = useState(false);
  const [filterOn, setFilterOn] = useState(false);
  const [queryMs, setQueryMs] = useState(3);
  const [deletingRows, setDeletingRows] = useState<Map<string, number>>(
    new Map(),
  );

  const displayRows = useMemo(
    function getRows() {
      const builtRows = buildRows(activeTable, sourceRows);
      const filteredRows = filterOn
        ? builtRows.filter(function filterRow(row) {
            return row.join(" ").toLowerCase().includes("san");
          })
        : builtRows;
      const sortIndex = columns.findIndex(function findColumn(column) {
        return column.name === activeSort;
      });
      if (sortIndex < 0) return filteredRows;
      return filteredRows.toSorted(function sortRows(a, b) {
        return a[sortIndex].localeCompare(b[sortIndex], undefined, {
          numeric: true,
        });
      });
    },
    [activeSort, activeTable, filterOn, sourceRows],
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

  function addRecord() {
    const nextId = String(sourceRows.length + 1);
    setSourceRows(function addRow(current) {
      return current.concat([
        [
          nextId,
          "New Contact " + nextId,
          "new" + nextId + "@example.com",
          "+1-555-010" + (Number(nextId) % 10),
          "San Francisco",
          "USA",
          "2026-06-05 12:00:00",
        ],
      ]);
    });
    setQueryMs(5);
  }

  function seedData() {
    setSourceRows(baseRows);
    setSelectedRows([]);
    setSelectedCell("1:1");
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
    setQueryMs(function bump(ms) {
      return ms === 3 ? 4 : 3;
    });
  }

  function toggleDryEdit() {
    setDryEdit(function toggle(value) {
      return !value;
    });
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
    <main className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div
        className="hero-app-demo__fade hero-app-demo__fade--main"
        aria-hidden="true"
      />
      {/* Tab bar + window controls — h-10 to line up with the sidebar's
                connection-switcher header so the divider runs straight across. */}
      <div className="flex items-center h-10 border-b border-border bg-sidebar shrink-0 select-none">
        <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
          <div className="flex items-center h-full shrink-0 border-r border-border bg-background text-foreground">
            <span className="flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium">
              <span className="max-w-[120px] truncate">{activeTable}</span>
            </span>
            <button
              type="button"
              onClick={seedData}
              className="h-full flex items-center px-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <WindowControls />
      </div>

      {/* Studio toolbar */}
      <div className="flex items-center h-9 pr-2 gap-1.5 text-sm bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-1 mr-1 pl-2">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <div className="flex items-center bg-sidebar-accent/50 rounded-[2px] p-px">
            <button
              type="button"
              onClick={function showTableView() {
                setJsonView(false);
              }}
              className={
                "flex h-6 w-6 items-center justify-center rounded-[2px] shadow-xs transition-colors " +
                (!jsonView
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground")
              }
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleJsonView}
              className={
                "flex h-6 w-6 items-center justify-center rounded-[2px] transition-colors " +
                (jsonView
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground")
              }
            >
              <FileJson className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-4 w-px bg-sidebar-border mx-0.5" />
          <GhostButton
            icon={Filter}
            label="Filters"
            active={filterOn}
            onClick={toggleFilter}
          />
          <GhostButton icon={Columns3} label="Columns" />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
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

      {/* Data grid */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="min-w-[1080px] text-xs font-mono">
          <div className={"grid " + GRID_COLS + " bg-sidebar"}>
            <GridCheckbox
              active={selectedRows.length === displayRows.length}
              onClick={toggleAllRows}
            />
            {columns.map(function mapHead(column) {
              return renderHead(column, activeSort, sortColumn);
            })}
          </div>
          {jsonView ? (
            <pre className="m-0 h-full min-h-[320px] overflow-hidden border-b border-sidebar-border bg-background px-4 py-3 text-[11px] leading-relaxed text-foreground/85">
              {JSON.stringify(
                displayRows.slice(0, 6).map(function mapJson(row) {
                  return {
                    id: row[0],
                    name: row[1],
                    email: row[2],
                    phone: row[3],
                    city: row[4],
                    country: row[5],
                    created_at: row[6],
                  };
                }),
                null,
                2,
              )}
            </pre>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {displayRows.map(function mapRow(row) {
                return (
                  <TableRow
                    key={row[0]}
                    row={row}
                    selectedRows={selectedRows}
                    selectedCell={selectedCell}
                    deletingRows={deletingRows}
                    onRowSelect={toggleRow}
                    onCellSelect={selectCell}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div
        className={
          "flex items-center justify-between h-10 px-3 bg-sidebar border-t border-sidebar-border shrink-0" +
          (selectedRows.length > 0 ? " relative z-[11]" : "")
        }
      >
        {selectedRows.length > 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground tabular-nums">
              {selectedRows.length} {selectedRows.length === 1 ? "row" : "rows"}{" "}
              selected
            </span>
            <div className="h-3.5 w-px bg-sidebar-border" />
            <button
              type="button"
              onClick={deleteSelected}
              className="inline-flex h-6 items-center gap-1.5 rounded-[2px] border border-red-500/30 bg-red-500/10 px-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Delete{" "}
              {selectedRows.length === 1
                ? "row"
                : `${selectedRows.length} rows`}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-6 items-center rounded-[2px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {queryMs}ms
            </span>
            <div className="h-3 w-px bg-sidebar-border" />
            <span>
              Showing 1-{displayRows.length} of {displayRows.length} rows
            </span>
          </div>
        )}
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

      {/* Floating AI assistant button */}
      <button
        type="button"
        className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-[3px] border border-border bg-background shadow-lg transition-colors hover:bg-sidebar-accent"
      >
        <Sparkles className="h-4 w-4 text-foreground" />
      </button>
    </main>
  );
}
