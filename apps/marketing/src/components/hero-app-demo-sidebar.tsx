"use client";

import {
  ChevronsUpDown,
  Container,
  Database,
  Filter,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SquareTerminal,
  Table2,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

type TTable = { name: string; base: number };
type TRailItem = { icon: LucideIcon; label: string };
type TDbType = "libsql" | "postgres" | "sqlite" | "mysql";
type TConnection = { id: string; name: string; type: TDbType; date: string };

/** Tables from the e-commerce demo schema that `/app` loads by default; `base`
 *  is the rough magnitude, jittered deterministically below so the counts read
 *  as organic rather than suspiciously round. */
const tables: TTable[] = [
  { name: "customers", base: 50 },
  { name: "products", base: 25 },
  { name: "orders", base: 100 },
  { name: "order_items", base: 150 },
  { name: "inventory", base: 120 },
  { name: "transactions", base: 250 },
  { name: "subscriptions", base: 60 },
];

/** Deterministic per-name hash → stable across SSR/CSR (no hydration mismatch)
 *  while still looking randomized. */
function seededCount(name: string, base: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const spread = Math.max(2, Math.round(base * 0.22));
  return base - spread + (h % (spread * 2 + 1));
}

const tableRows = tables.map(function withCount(t) {
  return { name: t.name, count: seededCount(t.name, t.base).toLocaleString() };
});

/** Labels match the real navigation-sidebar nav items. */
const railItems: TRailItem[] = [
  { icon: SquareTerminal, label: "SQL Console" },
  { icon: Table2, label: "Data Viewer" },
  { icon: Network, label: "Schema" },
  { icon: Container, label: "Docker Manager" },
];

const connections: TConnection[] = [
  {
    id: "demo",
    name: "Demo E-Commerce",
    type: "libsql",
    date: "Jun 5, 2026",
  },
  {
    id: "prod",
    name: "Production API",
    type: "postgres",
    date: "Jun 4, 2026",
  },
  {
    id: "analytics",
    name: "Analytics Warehouse",
    type: "postgres",
    date: "May 28, 2026",
  },
  { id: "staging", name: "Staging", type: "mysql", date: "Jun 1, 2026" },
  { id: "local", name: "Local Dev", type: "sqlite", date: "Jun 5, 2026" },
];

function formatDatabaseType(type: TDbType): string {
  switch (type) {
    case "libsql":
      return "Turso";
    case "postgres":
      return "PostgreSQL";
    case "sqlite":
      return "SQLite";
    case "mysql":
      return "MySQL";
    default:
      return "Database";
  }
}

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
  bottom,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  bottom?: boolean;
}) {
  const state = active
    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-white/8 shadow-sm"
    : "text-sidebar-foreground/88 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground";
  return (
    <div
      className={
        bottom
          ? "mt-auto flex w-full items-center justify-center"
          : "flex w-full items-center justify-center"
      }
    >
      <div
        className={
          "group/tip relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[7px] transition-colors " +
          state
        }
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        <Tip label={label} />
      </div>
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
        "group/row relative flex cursor-pointer ml-10 items-center gap-2.5 rounded-[2px] p-1.5 outline-hidden transition-colors " +
        (active ? "bg-sidebar-accent/40" : "hover:bg-sidebar-accent")
      }
    >
      <div
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border transition-colors " +
          (active
            ? "border-primary/30 bg-primary/5"
            : "border-sidebar-border bg-background")
        }
      >
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
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
          {formatDatabaseType(connection.type)} • {connection.date}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-0.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100">
        <button
          type="button"
          onClick={stop}
          aria-label={`Edit ${connection.name}`}
          className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label={`Delete ${connection.name}`}
          className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ConnectionSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState("demo");
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const active = connections.find((c) => c.id === activeId) ?? connections[0];

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
    setActiveId(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/* Connection-switcher trigger: fixed h-10 + bottom border so it
                aligns with the main panel's tab bar across the divide. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "group/trigger relative flex h-10 w-full items-center gap-2 border-b border-sidebar-border px-3.5 text-left text-sidebar-foreground transition-colors " +
          (open ? "bg-sidebar-accent/50" : "hover:bg-sidebar-accent/40")
        }
      >
        <div className="min-w-0 flex-1 text-left text-sm leading-none">
          <span className="truncate font-semibold text-foreground">
            {active.name}
          </span>
        </div>
        <ChevronsUpDown
          className={
            "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 " +
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
                className="h-7 w-full select-text rounded-[2px] border border-sidebar-border/70 bg-background/40 pl-7 pr-2 text-xs text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/60 focus:border-sidebar-border"
              />
            </div>
          </div>

          <div className="hero-connection-scrollbar max-h-[220px] overflow-y-auto px-1">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  active={c.id === activeId}
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
            className="flex w-full items-center gap-2.5 rounded-[2px] p-1.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-sidebar-border bg-background">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              Add connection
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-[2px] p-1.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-sidebar-border bg-background">
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
  onTableQueryChange: (value: string) => void;
  onTableSelect: (name: string) => void;
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
        "group flex h-8 w-full cursor-pointer items-center gap-2 px-2.5 text-left transition-colors " +
        (active
          ? "bg-sidebar-accent/95 rounded-[3px]"
          : "hover:bg-sidebar-accent/55 rounded-[3px]")
      }
    >
      <Table2 className="h-3.5 w-3.5 text-muted-foreground/90 shrink-0" />
      <span className="flex-1 text-[13px] text-sidebar-foreground truncate">
        {table.name}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
        {table.count}
      </span>
    </button>
  );
}

export function DemoSidebar({
  activeTable,
  tableQuery,
  onTableQueryChange,
  onTableSelect,
}: TDemoSidebarProps) {
  const visibleTables = tableRows.filter(function filterTable(table) {
    return tableMatches(table, tableQuery);
  });

  function updateTableQuery(event: React.ChangeEvent<HTMLInputElement>) {
    onTableQueryChange(event.target.value);
  }

  function clearTableQuery() {
    onTableQueryChange("");
  }

  return (
    <>
      {/* Navigation rail */}
      <aside className="z-50 flex h-full w-16 flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo header — fixed h-10 + bottom border so the rail's top
                    divider continues the connection-switcher / tab-bar line
                    straight across all three columns. */}
        <div className="flex h-10 items-center justify-center border-b border-sidebar-border shrink-0">
          <div className="group/tip relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80">
            <img
              src="/icons/logo.svg"
              alt=""
              className="h-6 w-6"
              draggable={false}
            />
            <Tip label="Go to Home" />
          </div>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1.5 p-2">
          <div className="flex w-full flex-col items-center gap-1.5">
            {railItems.map(renderRail)}
          </div>
          <RailButton icon={Settings} label="Settings" bottom />
        </nav>
      </aside>

      {/* Database sidebar keeps the same base color as the rail; the
                border and active states carry the separation. */}
      <div className="relative flex flex-col h-full w-[244px] bg-sidebar border-r border-sidebar-border select-none">
        <ConnectionSwitcher />

        {/* Search row: fixed h-9 + bottom border to align with the
                    main panel's studio toolbar. */}
        <div className="flex items-center gap-1.5 px-2.5 h-9 border-b border-sidebar-border shrink-0">
          <input
            value={tableQuery}
            onChange={updateTableQuery}
            placeholder="Search..."
            className="relative flex h-7 min-w-0 flex-1 items-center rounded-[2px] border border-sidebar-border/60 bg-background/30 px-3 text-xs text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/70 hover:border-sidebar-border focus:border-sidebar-border"
          />
          <div className="group/tip relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground shrink-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Filter className="h-3.5 w-3.5" />
            <Tip label="Filter tables" />
          </div>
          <button
            type="button"
            onClick={clearTableQuery}
            className="group/tip relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-[2px] text-muted-foreground shrink-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <Tip label="Refresh" />
          </button>
        </div>

        <div className="flex flex-col pt-1.5 pl-1.5 flex-1 overflow-hidden">
          {visibleTables.map(function mapTable(table) {
            return renderTable(table, activeTable, onTableSelect);
          })}
        </div>
      </div>
    </>
  );
}
