"use client";

import { DatabaseTypeIcon } from "@studio/features/connections/components/database-type-icon";
import {
  CalendarClock,
  ChartLine,
  ChevronsUpDown,
  Container,
  Filter,
  GitCompare,
  Hash,
  Info,
  Key,
  Link as LinkIcon,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  SquareTerminal,
  SunMedium,
  Table2,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type TConnection,
  connections,
  findConnection,
  formatDatabaseType,
} from "@/components/hero-app-demo-connections";
import {
  type TDemoColumn,
  demoTables,
  findTable,
} from "@/components/hero-app-demo-tables";

/**
 * Static replica of the real /app left rail + database sidebar. Class strings are
 * copied from the studio components (navigation-sidebar, connection-switcher,
 * table-search, table-list) so it renders against the same dark design tokens.
 *
 * The connection switcher is a faithful, lighter rebuild of the real Radix
 * ConnectionSwitcher — open/close, chevron rotate, select-to-switch, search
 * filter, click-outside/Escape, hover edit/delete — but renders inline (no
 * portal) so it inherits the demo's local dark token overrides. Hover/cursor/
 * tooltip affordances stay pure CSS.
 */

type TRailItem = { icon: LucideIcon; label: string };

/** Rough magnitude per table, jittered deterministically below so the counts
 *  read as organic rather than suspiciously round. */
const tableMagnitude: Record<string, number> = {
  customers: 1250,
  products: 340,
  orders: 4800,
  order_items: 12600,
  inventory: 890,
  transactions: 21400,
  subscriptions: 620,
};

/** Deterministic per-name hash → stable across SSR/CSR (no hydration mismatch)
 *  while still looking randomized. */
function seededCount(name: string, base: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const spread = Math.max(2, Math.round(base * 0.22));
  return base - spread + (h % (spread * 2 + 1));
}

/** Compact row counts like the real table-list's formatRowCount (1.2K, 21.4K). */
function formatRowCount(count: number): string {
  if (count < 1000) return String(count);
  return (count / 1000).toFixed(1) + "K";
}

const tableRows = demoTables.map(function withCount(table) {
  return {
    name: table.name,
    count: formatRowCount(
      seededCount(table.name, tableMagnitude[table.name] ?? 500),
    ),
  };
});

/** Labels match the real navigation-sidebar nav items. */
const railItems: TRailItem[] = [
  { icon: SquareTerminal, label: "SQL Console" },
  { icon: Table2, label: "Data Viewer" },
  { icon: ChartLine, label: "Analytics" },
  { icon: Network, label: "Schema" },
  { icon: GitCompare, label: "Schema Diff" },
  { icon: Container, label: "Docker Manager" },
];

/** CSS-only tooltip: appears to the right on hover, with a short reveal delay
 *  so it feels like the real app's Radix tooltip (no instant flash). The host
 *  element must carry `group/tip relative`. */
function Tip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 translate-x-[-3px] whitespace-nowrap rounded-md border border-sidebar-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 transition-[opacity,transform] duration-150 group-hover/tip:translate-x-0 group-hover/tip:opacity-100 group-hover/tip:delay-300"
      role="tooltip"
    >
      {label}
    </span>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  const state = active
    ? "bg-sidebar-accent/80 text-sidebar-accent-foreground ring-1 ring-sidebar-border/70 shadow-sm"
    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  return (
    <div
      className={
        "group/tip relative mx-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors " +
        state
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <Tip label={label} />
    </div>
  );
}

function renderRail(item: TRailItem, index: number) {
  return (
    <RailButton
      key={item.label}
      icon={item.icon}
      label={item.label}
      active={index === 1}
    />
  );
}

/** Stand-in for the studio's SourceBadges: same outline/secondary badge shapes,
 *  driven by the demo's flat connection shape. */
function SourceBadges({
  connection,
  showLocation = true,
}: {
  connection: TConnection;
  showLocation?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      <span className="inline-flex h-4 shrink-0 items-center rounded-sm border border-border/70 px-1.5 text-[10px] leading-4 font-normal text-foreground/90">
        {formatDatabaseType(connection.type)}
      </span>
      {showLocation && (
        <span className="inline-flex h-4 shrink-0 items-center rounded-sm bg-secondary px-1.5 text-[10px] leading-4 font-normal text-secondary-foreground">
          {connection.location}
        </span>
      )}
    </span>
  );
}

function rowIconTone(connection: TConnection, active: boolean): string {
  if (connection.status === "error")
    return "border-destructive/40 bg-destructive/5";
  if (active) return "border-primary/30 bg-primary/5";
  return "border-border bg-background";
}

function ConnectionRow({
  connection,
  active,
  onSelect,
}: {
  connection: TConnection;
  active: boolean;
  onSelect: () => void;
}) {
  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onSelect}
      className={
        "group/row relative flex cursor-pointer items-center gap-2.5 overflow-hidden p-2 outline-hidden transition-colors " +
        (active ? "bg-sidebar-accent/40" : "hover:bg-sidebar-accent")
      }
    >
      <div
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors " +
          rowIconTone(connection, active)
        }
      >
        <DatabaseTypeIcon
          type={connection.type}
          className="h-3.5 w-3.5 text-muted-foreground"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            "truncate text-sm " +
            (active ? "font-medium text-foreground" : "text-foreground/90")
          }
        >
          {connection.name}
        </div>
        <div className="truncate text-[10px] text-muted-foreground/80">
          {connection.location} • {connection.date}
        </div>
        <div className="mt-1">
          <SourceBadges connection={connection} showLocation={false} />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-0.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100">
        <button
          type="button"
          onClick={stop}
          aria-label={`Edit ${connection.name}`}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label={`Delete ${connection.name}`}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ConnectionSwitcher({
  activeConnectionId,
  onSelectConnection,
}: {
  activeConnectionId: string;
  onSelectConnection: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const active = findConnection(activeConnectionId);

  const filtered = useMemo(
    function getFiltered() {
      const q = query.trim().toLowerCase();
      if (!q) return connections;
      return connections.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          formatDatabaseType(c.type).toLowerCase().includes(q),
      );
    },
    [query],
  );

  useEffect(
    function bindDismiss() {
      if (!open) return;
      function onDown(e: MouseEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node))
          setOpen(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      }
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return function cleanup() {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
      };
    },
    [open],
  );

  function select(id: string) {
    onSelectConnection(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "group/trigger relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sidebar-foreground transition-colors " +
          (open ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent")
        }
      >
        <div
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors " +
            (active.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary group-hover/trigger:bg-primary/15")
          }
        >
          <DatabaseTypeIcon type={active.type} className="h-4 w-4" />
        </div>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
          <span
            className={
              "truncate font-semibold " +
              (active.status === "error"
                ? "text-destructive"
                : "text-foreground")
            }
          >
            {active.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <SourceBadges connection={active} />
          </span>
        </div>
        <ChevronsUpDown
          className={
            "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 " +
            (open ? "rotate-180 text-foreground" : "")
          }
        />
      </button>

      {open && (
        <div className="absolute left-1.5 right-1.5 top-[calc(100%+6px)] z-50 origin-top rounded-[3px] border border-sidebar-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
          <div className="space-y-2 px-2 pb-2 pt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Databases
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground/70">
                {query.trim()
                  ? `${filtered.length}/${connections.length}`
                  : connections.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search connections..."
                className="h-7 w-full select-text rounded-md border border-input bg-background/40 pl-7 pr-2 text-xs text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/60 focus:border-sidebar-border"
              />
            </div>
          </div>

          <div className="hero-connection-scrollbar max-h-[260px] overflow-y-auto px-1">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  active={c.id === activeConnectionId}
                  onSelect={() => select(c.id)}
                />
              ))
            ) : (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                No matching connections
              </div>
            )}
          </div>

          <div className="my-1 h-px bg-sidebar-border" />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 p-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              Add connection
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 p-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              Manage connections
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

type TDemoSidebarProps = {
  activeTable: string;
  tableQuery: string;
  activeConnectionId: string;
  onTableQueryChange: (value: string) => void;
  onTableSelect: (name: string) => void;
  onSelectConnection: (id: string) => void;
};

function tableMatches(table: { name: string }, query: string) {
  return table.name.toLowerCase().includes(query.trim().toLowerCase());
}

function renderTable(
  table: { name: string; count: string },
  activeTable: string,
  onTableSelect: (name: string) => void,
) {
  const active = table.name === activeTable;

  function selectTable() {
    onTableSelect(table.name);
  }

  return (
    <button
      type="button"
      key={table.name}
      onClick={selectTable}
      className={
        "group flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors " +
        (active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60")
      }
    >
      <Table2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm text-sidebar-foreground truncate">
        {table.name}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 group-hover:hidden">
        {table.count}
      </span>
      <span className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-muted-foreground transition-colors group-hover:flex hover:bg-background/60 hover:text-foreground">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function DemoSidebar({
  activeTable,
  tableQuery,
  activeConnectionId,
  onTableQueryChange,
  onTableSelect,
  onSelectConnection,
}: TDemoSidebarProps) {
  const table = findTable(activeTable);
  const visibleTables = tableRows.filter(function filterTable(row) {
    return tableMatches(row, tableQuery);
  });

  function updateTableQuery(event: React.ChangeEvent<HTMLInputElement>) {
    onTableQueryChange(event.target.value);
  }

  function clearTableQuery() {
    onTableQueryChange("");
  }

  return (
    <>
      {/* Navigation rail — real navigation-sidebar: pt-2 logo stack with a
          short divider below it, border-r toward the database sidebar. */}
      <aside className="relative z-0 flex h-full w-16 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col items-center justify-center pt-2 gap-4 shrink-0">
          <div className="group/tip relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80">
            <img
              src="/icons/logo.svg"
              alt=""
              className="mx-auto h-7 w-7 shrink-0"
              draggable={false}
            />
            <Tip label="Go to Home" />
          </div>
          <div className="w-8 h-px bg-sidebar-border" role="separator" />
        </div>
        <nav className="flex w-full flex-1 flex-col gap-1 p-2">
          <div className="mx-auto flex flex-col gap-1">
            {railItems.map(renderRail)}
          </div>
          <div className="mx-auto mt-auto flex flex-col gap-1">
            <RailButton icon={Settings} label="Settings" />
          </div>
        </nav>
      </aside>

      {/* Database sidebar — border-r divides main; the rail carries its own. */}
      <div className="relative flex flex-col h-full w-[244px] shrink-0 bg-sidebar border-r border-sidebar-border select-none">
        <ConnectionSwitcher
          activeConnectionId={activeConnectionId}
          onSelectConnection={onSelectConnection}
        />

        {/* Search row — real database-sidebar: px-2 py-2 with a border-t. */}
        <div className="flex items-center gap-1.5 border-t border-sidebar-border px-2 py-2 shrink-0">
          <input
            value={tableQuery}
            onChange={updateTableQuery}
            placeholder="Search tables..."
            className="relative flex h-8 min-w-0 flex-1 items-center rounded-md border border-sidebar-border/60 bg-background/30 px-3 text-xs text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/70 hover:border-sidebar-border focus:border-sidebar-border"
          />
          <div className="group/tip relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground shrink-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Filter className="h-3.5 w-3.5" />
            <Tip label="Filter tables" />
          </div>
          <button
            type="button"
            onClick={clearTableQuery}
            className="group/tip relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground shrink-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <Tip label="Refresh" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-1">
          {visibleTables.map(function mapTable(table) {
            return renderTable(table, activeTable, onTableSelect);
          })}
        </div>

        {/* Structure panel — 1:1 with the real SidebarBottomPanel: bordered
            STRUCTURE header, typed column rows, INDEXES footer. Reflects the
            active table's real schema, so it agrees with the grid. */}
        <div className="flex shrink-0 flex-col border-t border-sidebar-border bg-sidebar">
          <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar/50 px-3 py-2">
            <span className="text-xs font-medium text-sidebar-foreground">
              STRUCTURE
            </span>
            <span className="text-xs text-muted-foreground">
              {table.columns.length} columns
            </span>
          </div>
          <div className="hero-connection-scrollbar flex max-h-[132px] flex-col overflow-y-auto py-1">
            {table.columns.map(renderStructureColumn)}
          </div>
          <div className="flex h-10 shrink-0 cursor-pointer items-center border-t border-sidebar-border bg-sidebar/50 px-3 transition-colors hover:bg-sidebar-accent/50">
            <span className="text-xs font-medium text-muted-foreground">
              INDEXES
            </span>
            <span className="ml-auto text-xs text-muted-foreground/60">
              {table.indexes}
            </span>
          </div>
        </div>

        {/* Bottom toolbar — What's new / Info / theme / Settings, like the
            real sidebar BottomToolbar strip. */}
        <div className="flex shrink-0 items-end justify-between gap-2 border-t border-sidebar-border px-2 py-1.5">
          <div className="group/tip relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Sparkles className="h-4 w-4" />
            <Tip label="What's new" />
          </div>
          <div className="flex items-center gap-0.5">
            <div className="group/tip relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <Info className="h-4 w-4" />
              <Tip label="Project info" />
            </div>
            <div className="group/tip relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <SunMedium className="h-4 w-4" />
              <Tip label="Toggle theme" />
            </div>
            <div className="group/tip relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <Settings className="h-4 w-4" />
              <Tip label="Settings" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function renderStructureColumn(column: TDemoColumn) {
  const icon =
    column.kind === "pk" ? (
      <Key className="h-3 w-3 shrink-0 text-amber-500" />
    ) : column.kind === "fk" ? (
      <LinkIcon className="h-3 w-3 shrink-0 text-blue-500" />
    ) : column.kind === "number" || column.kind === "money" ? (
      <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
    ) : column.kind === "date" ? (
      <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
    ) : (
      <Type className="h-3 w-3 shrink-0 text-muted-foreground" />
    );
  return (
    <div
      key={column.name}
      className="group flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-sidebar-accent/50"
    >
      {icon}
      <span className="flex-1 truncate font-medium text-sidebar-foreground">
        {column.name}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
        {column.type}
      </span>
    </div>
  );
}
