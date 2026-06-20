import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAdapter, useIsTauri } from "@studio/core/data-provider/context";
import { useConnections } from "@studio/core/data-provider";
import { askAi, buildExplainQueryPrompt } from "@studio/features/ai-assistant/ai-actions";
import { getAdapterError } from "@studio/core/data-provider/types";
import { useShortcut, useActiveScope, useEffectiveShortcuts } from "@studio/core/shortcuts";
import {
  SQL_CONSOLE_PALETTE_EVENT,
  type SqlConsolePaletteCommand,
} from "@studio/features/command-palette/events";
import type { AiAssistantEditorContext } from "@studio/features/ai-assistant/types";
import { ResizablePanels } from "@studio/features/drizzle-runner/components/resizable-panels";
import { PrismaRunner } from "@studio/features/prisma-runner";
import type { SavedQuery } from "@studio/lib/bindings";

import { DEFAULT_QUERY } from "../../features/drizzle-runner/data";
import {
  buildDefaultDrizzleQuery,
  buildDefaultSqlQuery,
  pickDefaultQueryTable,
} from "@studio/shared/utils/default-query-table";
import { drizzleQueryToSql } from "../../features/drizzle-runner/utils/drizzle-query";
import { AiCmdK } from "./components/ai-cmd-k";
import { ConsoleHeader, EditorActionBar } from "./components/console-toolbar";
import { QueryTabBar } from "./components/query-tab-bar";
import { QueryHistoryPanel } from "./components/query-history-panel";
import { SqlResults } from "./components/sql-results";
import { UnifiedSidebar } from "./components/unified-sidebar";
import { DEFAULT_SQL } from "./data";
import { extractMutationSourceTable } from "./query-target";
import { useQueryHistory } from "./stores/query-history-store";
import { QueryTabProvider, useQueryTabs } from "./stores/tab-store";
import { clearTableDataCache } from "@studio/core/table-cache";
import { Skeleton } from "@studio/shared/ui/skeleton";
import { toast } from "@studio/shared/ui/notifier";
import { SqlQueryResult, ResultViewMode, SqlSnippet, TableInfo } from "./types";
import type { ResultChartConfig } from "@studio/features/result-charts/types";

const SqlEditor = lazy(function () {
  return import("./components/sql-editor").then(function (module) {
    return { default: module.SqlEditor };
  });
});

const CodeEditor = lazy(function () {
  return import("@studio/features/drizzle-runner/components/code-editor").then(function (module) {
    return { default: module.CodeEditor };
  });
});

function notifyFailure(title: string, error: unknown) {
  toast.error(title, {
    description: error instanceof Error ? error.message : String(error),
  });
}

type Props = {
  activeConnectionId?: string;
  getConnectionName?: (id: string) => string;
  onEditorContextChange?: (context: AiAssistantEditorContext | null) => void;
};

export function SqlConsole(props: Props) {
  return (
    <QueryTabProvider connectionId={props.activeConnectionId || null}>
      <SqlConsoleInner {...props} />
    </QueryTabProvider>
  );
}

function SqlConsoleInner({
  activeConnectionId,
  getConnectionName,
  onEditorContextChange,
}: Props) {
  const adapter = useAdapter();
  const isTauri = useIsTauri();
  const { data: connections } = useConnections();
  const tabStore = useQueryTabs();
  const { activeTab } = tabStore;
  const shortcuts = useEffectiveShortcuts();

  // Derive per-tab state
  const mode = activeTab.mode;
  const currentSqlQuery = activeTab.sqlContent;
  const currentDrizzleQuery = activeTab.drizzleContent;
  const result = activeTab.result;
  const isExecuting = activeTab.isExecuting;
  const viewMode = activeTab.viewMode;
  const chartConfig = activeTab.chartConfig;
  const historyEntryId = activeTab.historyEntryId;

  function setMode(m: "sql" | "drizzle" | "prisma") {
    tabStore.setTabMode(activeTab.id, m);
  }
  function setCurrentSqlQuery(v: string) {
    tabStore.updateTabContent(activeTab.id, "sqlContent", v);
  }
  function setCurrentDrizzleQuery(v: string) {
    tabStore.updateTabContent(activeTab.id, "drizzleContent", v);
  }
  function setResult(r: SqlQueryResult | null) {
    tabStore.setTabResult(activeTab.id, r);
  }
  function setIsExecuting(v: boolean) {
    tabStore.setTabExecuting(activeTab.id, v);
  }
  function setViewMode(v: ResultViewMode) {
    tabStore.setTabViewMode(activeTab.id, v);
  }

  function renderEditorFallback() {
    return (
      <div className="h-full bg-editor p-4">
        <div className="h-full rounded-md border border-border/60 bg-black/20 p-4">
          <div className="space-y-3">
            {["w-5/12", "w-8/12", "w-6/12", "w-7/12", "w-4/12"].map(function (width, index) {
              return <Skeleton key={index} className={`h-4 bg-white/10 ${width}`} />;
            })}
          </div>
        </div>
      </div>
    );
  }

  const [snippets, setSnippets] = useState<SqlSnippet[]>([]);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>("playground");
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const sbwRef = useRef(256);
  const cancelledRef = useRef(false);
  const [autoExpandFolder, setAutoExpandFolder] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAiCmdK, setShowAiCmdK] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);

  const { addToHistory, updateChartConfig } = useQueryHistory();

  const handleChartConfigChange = useCallback(
    function (nextChartConfig: ResultChartConfig) {
      tabStore.setTabChartConfig(activeTab.id, nextChartConfig);
      if (historyEntryId) {
        updateChartConfig(historyEntryId, nextChartConfig);
      }
    },
    [activeTab.id, historyEntryId, tabStore, updateChartConfig],
  );

  useEffect(
    function syncAiEditorContext() {
      if (!onEditorContextChange) return;
      if (mode === "prisma") {
        onEditorContextChange(null);
        return;
      }
      onEditorContextChange({
        mode,
        content: mode === "sql" ? currentSqlQuery : currentDrizzleQuery,
      });

      return function clearAiEditorContext() {
        onEditorContextChange(null);
      };
    },
    [mode, currentSqlQuery, currentDrizzleQuery, onEditorContextChange],
  );

  const refreshSchema = useCallback(async () => {
    if (!activeConnectionId) {
      setTables([]);
      return;
    }

    try {
      await adapter.connectToDatabase(activeConnectionId);
      const res = await adapter.getSchema(activeConnectionId);
      if (res.ok && res.data.tables) {
        const mapped: TableInfo[] = res.data.tables.map(function (t) {
          return {
            name: t.name,
            schema: t.schema,
            type: "table" as const,
            rowCount: t.row_count_estimate ?? 0,
            columns: t.columns.map(function (c) {
              return {
                name: c.name,
                type: c.data_type,
                nullable: c.is_nullable,
                primaryKey: c.is_primary_key,
              };
            }),
          };
        });
        setTables(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch schema:", error);
      notifyFailure("Failed to fetch schema", error);
    }
  }, [activeConnectionId, adapter]);

  const loadSnippets = useCallback(async () => {
    const [scriptsRes, foldersRes] = await Promise.all([
      adapter.getScripts(activeConnectionId || null),
      adapter.getSnippetFolders(),
    ]);

    const newSnippets: SqlSnippet[] = [];

    if (foldersRes.ok) {
      foldersRes.data.forEach((f) => {
        newSnippets.push({
          id: `folder-${f.id}`,
          name: f.name,
          content: "",
          createdAt: new Date(f.created_at),
          updatedAt: new Date(f.updated_at),
          isFolder: true,
          parentId: f.parent_id ? `folder-${f.parent_id}` : null,
        });
      });
    }

    if (scriptsRes.ok) {
      scriptsRes.data.forEach((s) => {
        newSnippets.push({
          id: s.id.toString(),
          name: s.name,
          content: s.query_text,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
          isFolder: false,
          parentId: s.folder_id ? `folder-${s.folder_id}` : null,
        });
      });
    }

    setSnippets(newSnippets);
  }, [adapter, activeConnectionId]);

  useEffect(
    function () {
      if (activeConnectionId) {
        loadSnippets().catch(function (error) {
          console.error("Failed to load snippets:", error);
          notifyFailure("Failed to load snippets", error);
        });
      }
    },
    [activeConnectionId, loadSnippets],
  );

  useEffect(
    function () {
      if (!activeConnectionId) {
        setTables([]);
        setCurrentSqlQuery(DEFAULT_SQL);
        setCurrentDrizzleQuery(DEFAULT_QUERY);
        return;
      }

      let cancelled = false;

      async function fetchSchema() {
        try {
          await adapter.connectToDatabase(activeConnectionId!);
          const res = await adapter.getSchema(activeConnectionId!);
          if (cancelled) return;
          if (res.ok && res.data.tables) {
            const mapped: TableInfo[] = res.data.tables.map(function (t) {
              return {
                name: t.name,
                schema: t.schema,
                type: "table" as const,
                rowCount: t.row_count_estimate ?? 0,
                columns: t.columns.map(function (c) {
                  return {
                    name: c.name,
                    type: c.data_type,
                    nullable: c.is_nullable,
                    primaryKey: c.is_primary_key,
                  };
                }),
              };
            });
            setTables(mapped);

            if (mapped.length > 0) {
              const defaultTable = pickDefaultQueryTable(mapped);
              if (defaultTable) {
                setCurrentSqlQuery(buildDefaultSqlQuery(defaultTable.name));
                setCurrentDrizzleQuery(buildDefaultDrizzleQuery(defaultTable.name));
              } else {
                setCurrentSqlQuery(DEFAULT_SQL);
                setCurrentDrizzleQuery(DEFAULT_QUERY);
              }
            } else {
              setCurrentSqlQuery(DEFAULT_SQL);
              setCurrentDrizzleQuery(DEFAULT_QUERY);
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to fetch schema:", error);
            notifyFailure("Failed to fetch schema", error);
          }
        }
      }

      fetchSchema();

      return function () {
        cancelled = true;
      };
    },
    [activeConnectionId, adapter],
  );

  useEffect(
    function listenForSchemaRefresh() {
      function onSchemaRefresh(event: Event) {
        const customEvent = event as CustomEvent<{ connectionId?: string }>;
        const targetConnectionId = customEvent.detail?.connectionId;
        if (!targetConnectionId || targetConnectionId === activeConnectionId) {
          refreshSchema().catch(function (error) {
            console.error("Failed to refresh schema:", error);
            notifyFailure("Failed to refresh schema", error);
          });
        }
      }

      window.addEventListener("dora-schema-refresh", onSchemaRefresh as EventListener);
      return function () {
        window.removeEventListener("dora-schema-refresh", onSchemaRefresh as EventListener);
      };
    },
    [activeConnectionId, refreshSchema],
  );

  useEffect(
    function listenForOpenTableInSql() {
      function onOpenTable(event: Event) {
        const { tableName } = (event as CustomEvent<{ tableName: string }>).detail;
        tabStore.setTabMode(activeTab.id, "sql");
        tabStore.updateTabContent(
          activeTab.id,
          "sqlContent",
          `SELECT * FROM ${tableName} LIMIT 100;`,
        );
      }

      window.addEventListener("dora-open-table-in-sql", onOpenTable as EventListener);
      return function () {
        window.removeEventListener("dora-open-table-in-sql", onOpenTable as EventListener);
      };
    },
    [activeTab.id, tabStore],
  );

  // Seed the active tab with arbitrary SQL handed off from another feature
  // (e.g. the ORM cockpit's generated migration). Mirrors the table-open event.
  useEffect(
    function listenForOpenSqlContent() {
      function onOpenSql(event: Event) {
        const { sql } = (event as CustomEvent<{ sql?: string }>).detail ?? {};
        if (typeof sql !== "string") return;
        tabStore.setTabMode(activeTab.id, "sql");
        tabStore.updateTabContent(activeTab.id, "sqlContent", sql);
      }

      window.addEventListener("dora-open-sql-content", onOpenSql as EventListener);
      return function () {
        window.removeEventListener("dora-open-sql-content", onOpenSql as EventListener);
      };
    },
    [activeTab.id, tabStore],
  );

  const handleExecute = useCallback(
    async (codeOverride?: string, modeOverride?: "sql" | "drizzle") => {
      if (isExecuting) return;
      // Prisma mode is handled by the self-contained PrismaRunner.
      if (!modeOverride && mode === "prisma") return;

      cancelledRef.current = false;
      setIsExecuting(true);
      setResult(null);
      const nextMode = modeOverride || mode;
      const historyQuery =
        codeOverride || (nextMode === "sql" ? currentSqlQuery : currentDrizzleQuery);

      try {
        if (nextMode === "sql") {
          const queryToRun = codeOverride || currentSqlQuery;
          if (!activeConnectionId) {
            throw new Error("No connection selected");
          }
          const res = await adapter.executeQuery(activeConnectionId, queryToRun);
          if (res.ok) {
            const columns = Array.isArray(res.data.columns) ? res.data.columns : [];
            const columnDefinitions = res.data.columnDefinitions;

            const rows = Array.isArray(res.data.rows)
              ? res.data.rows.map((row: any) => {
                  if (typeof row === "object" && row !== null && !Array.isArray(row)) {
                    return row;
                  }
                  if (Array.isArray(row)) {
                    const obj: Record<string, any> = {};
                    columns.forEach((col: string, i: number) => {
                      obj[col] = row[i];
                    });
                    return obj;
                  }
                  return {};
                })
              : [];

            const queryType = getQueryType(queryToRun);

            setResult({
              columns,
              rows,
              rowCount: res.data.rowCount,
              executionTime: res.data.executionTime || 0,
              queryType,
              columnDefinitions,
              sourceTable: extractMutationSourceTable(queryToRun),
              executedQuery: queryToRun,
            });
            // Auto-title the tab from the query
            tabStore.autoTitleTab(activeTab.id, queryToRun);

            // Clear table viewer cache so it refetches when user switches to it.
            if (queryType !== "SELECT") {
              clearTableDataCache();
            }

            // Schema + row-count metadata must refresh after DDL and row-changing SQL.
            const shouldRefreshSchema =
              /\b(create|alter|drop|truncate|rename|attach|detach|insert|delete|merge|replace)\b/i.test(
                queryToRun,
              );
            if (shouldRefreshSchema) {
              window.dispatchEvent(
                new CustomEvent("dora-schema-refresh", {
                  detail: { connectionId: activeConnectionId },
                }),
              );
            }

            const historyId = addToHistory({
              query: queryToRun,
              connectionId: activeConnectionId,
              executionTimeMs: res.data.executionTime || 0,
              success: true,
              rowCount: res.data.rowCount,
              chartConfig,
            });
            tabStore.setTabHistoryEntry(activeTab.id, historyId);
          } else {
            throw new Error(getAdapterError(res));
          }
        } else {
          const queryToRun = codeOverride || currentDrizzleQuery;
          if (!activeConnectionId) {
            throw new Error("No connection selected");
          }

          const sqlToRun = drizzleQueryToSql(queryToRun);
          const res = await adapter.executeQuery(activeConnectionId, sqlToRun);

          if (res.ok) {
            setResult({
              columns: res.data.columns,
              rows: res.data.rows,
              rowCount: res.data.rowCount,
              executionTime: res.data.executionTime || 0,
              error: res.data.error,
              queryType: getQueryType(sqlToRun),
              columnDefinitions: res.data.columnDefinitions,
              sourceTable: extractMutationSourceTable(queryToRun),
              executedQuery: sqlToRun,
            });

            // Drizzle queries may also mutate data (insert, update, delete).
            const lowerQuery = queryToRun.toLowerCase();
            const mutatesData =
              lowerQuery.includes(".insert") ||
              lowerQuery.includes(".update") ||
              lowerQuery.includes(".delete");
            if (mutatesData) {
              clearTableDataCache();
            }

            const changesRowCount =
              lowerQuery.includes(".insert") || lowerQuery.includes(".delete");
            if (changesRowCount) {
              window.dispatchEvent(
                new CustomEvent("dora-schema-refresh", {
                  detail: { connectionId: activeConnectionId },
                }),
              );
            }
          } else {
            throw new Error(getAdapterError(res));
          }
        }
      } catch (error) {
        if (!cancelledRef.current) {
          const errorMsg = error instanceof Error ? error.message : "An error occurred";
          setResult({
            columns: [],
            rows: [],
            rowCount: 0,
            executionTime: 0,
            error: errorMsg,
            queryType: "OTHER",
          });

          const historyId = addToHistory({
            query: historyQuery,
            connectionId: activeConnectionId || null,
            executionTimeMs: 0,
            success: false,
            error: errorMsg,
          });
          tabStore.setTabHistoryEntry(activeTab.id, historyId);
        }
      } finally {
        cancelledRef.current = false;
        setIsExecuting(false);
      }
    },
    [
      mode,
      currentSqlQuery,
      currentDrizzleQuery,
      isExecuting,
      activeConnectionId,
      adapter,
      addToHistory,
      activeTab.id,
      chartConfig,
      tabStore,
    ],
  );

  const handleCancel = useCallback(async () => {
    cancelledRef.current = true;
    if (activeConnectionId) {
      await adapter.cancelActiveQuery(activeConnectionId);
    }
  }, [adapter, activeConnectionId]);

  const activeDialect = useMemo(() => {
    const connection = connections?.find(function (c) {
      return c.id === activeConnectionId;
    });
    if (!connection) return "unknown";
    const type = connection.type;
    if (type === "sqlite" || type === "libsql" || type === "duckdb") return "sqlite";
    if (type === "postgres" || type === "cockroach") return "postgres";
    if (type === "mysql" || type === "mariadb") return "mysql";
    return "unknown";
  }, [connections, activeConnectionId]);

  const handleExplainQuery = useCallback(() => {
    const query = (mode === "sql" ? currentSqlQuery : currentDrizzleQuery).trim();
    if (!query) return;
    askAi(buildExplainQueryPrompt(query));
  }, [mode, currentSqlQuery, currentDrizzleQuery]);

  const handleExplainAnalyze = useCallback(() => {
    const baseQuery = currentSqlQuery.trim().replace(/;\s*$/, "");
    if (!baseQuery) return;

    let explained: string;
    if (activeDialect === "sqlite") {
      // SQLite does not support EXPLAIN ANALYZE; use EXPLAIN QUERY PLAN.
      explained = `EXPLAIN QUERY PLAN ${baseQuery}`;
    } else if (activeDialect === "postgres") {
      explained = `EXPLAIN (ANALYZE, FORMAT JSON) ${baseQuery}`;
    } else {
      // MySQL / MariaDB / unknown: best-effort text plan.
      explained = `EXPLAIN ANALYZE ${baseQuery}`;
    }

    if (mode !== "sql") {
      setMode("sql");
    }
    handleExecute(explained, "sql").catch(function (error) {
      console.error("Failed to run EXPLAIN ANALYZE:", error);
      notifyFailure("Failed to run EXPLAIN ANALYZE", error);
    });
  }, [activeDialect, currentSqlQuery, mode, handleExecute]);

  useEffect(
    function registerCaptureHelpers() {
      if (typeof window === "undefined") return;
      if (!window.__DORA_CAPTURE_MODE) return;

      window.__DORA_CAPTURE_SET_SQL = function (sql: string) {
        tabStore.setTabMode(activeTab.id, "sql");
        tabStore.updateTabContent(activeTab.id, "sqlContent", sql);
      };

      window.__DORA_CAPTURE_RUN_SQL = function (sql: string) {
        void handleExecute(sql, "sql");
      };

      window.__DORA_CAPTURE_SET_DRIZZLE = function (code: string) {
        tabStore.setTabMode(activeTab.id, "drizzle");
        tabStore.updateTabContent(activeTab.id, "drizzleContent", code);
      };

      window.__DORA_CAPTURE_RUN_DRIZZLE = function (code: string) {
        void handleExecute(code, "drizzle");
      };

      return function () {
        delete window.__DORA_CAPTURE_SET_SQL;
        delete window.__DORA_CAPTURE_RUN_SQL;
        delete window.__DORA_CAPTURE_SET_DRIZZLE;
        delete window.__DORA_CAPTURE_RUN_DRIZZLE;
      };
    },
    [activeTab.id, handleExecute, tabStore],
  );

  useEffect(
    function listenForPaletteCommands() {
      function onPaletteCommand(event: Event) {
        const customEvent = event as CustomEvent<SqlConsolePaletteCommand>;
        const detail = customEvent.detail;

        if (!detail) return;

        if (detail.type === "set-mode") {
          setMode(detail.mode);
          return;
        }

        if (detail.type === "toggle-history") {
          setShowHistory(function (current) {
            return detail.open ?? !current;
          });
          return;
        }

        if (detail.type === "load-query") {
          const targetMode = detail.mode || inferPaletteMode(detail.query);

          setMode(targetMode);
          if (targetMode === "sql") {
            setCurrentSqlQuery(detail.query);
          } else {
            setCurrentDrizzleQuery(detail.query);
          }

          if (detail.execute) {
            requestAnimationFrame(function () {
              handleExecute(detail.query, targetMode).catch(function (error) {
                console.error("Failed to execute palette SQL command:", error);
                notifyFailure("Failed to execute SQL command", error);
              });
            });
          }
        }
      }

      window.addEventListener(SQL_CONSOLE_PALETTE_EVENT, onPaletteCommand as EventListener);
      return function () {
        window.removeEventListener(SQL_CONSOLE_PALETTE_EVENT, onPaletteCommand as EventListener);
      };
    },
    [handleExecute],
  );

  function getQueryType(query: string): "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER" {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith("SELECT")) return "SELECT";
    if (trimmed.startsWith("INSERT")) return "INSERT";
    if (trimmed.startsWith("UPDATE")) return "UPDATE";
    if (trimmed.startsWith("DELETE")) return "DELETE";
    return "OTHER";
  }
  function handlePrettify() {
    if (mode === "sql") {
      const lines = currentSqlQuery.split("\n");
      const prettified = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
      setCurrentSqlQuery(prettified);
    } else {
      const lines = currentDrizzleQuery.split("\n");
      const prettified = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
      setCurrentDrizzleQuery(prettified);
    }
  }

  const handleExport = useCallback(
    function () {
      if (!result || result.rows.length === 0) return;

      const jsonString = JSON.stringify(result.rows, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "query-results.json";
      a.click();
      URL.revokeObjectURL(url);
    },
    [result],
  );

  const handleExportCsv = useCallback(
    function () {
      if (!result || result.rows.length === 0) return;

      const headers = result.columns.join(",");
      const rows = result.rows
        .map(function (row) {
          return result.columns
            .map(function (col) {
              const value = row[col];
              if (value === null || value === undefined) return "";
              const stringValue = String(value);
              if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                return '"' + stringValue.replace(/"/g, '""') + '"';
              }
              return stringValue;
            })
            .join(",");
        })
        .join("\n");

      const csvContent = headers + "\n" + rows;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "query-results.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
    [result],
  );

  const toggleRightSidebar = useCallback(
    function () {
      if (showRightSidebar) {
        setShowRightSidebar(false);
        return;
      }

      sbwRef.current = sidebarWidth || 256;
      setSidebarWidth(sbwRef.current);
      setShowRightSidebar(true);
    },
    [showRightSidebar, sidebarWidth],
  );

  // Unified snippet handling - works for both SQL and Drizzle
  const handleSnippetSelect = useCallback(
    (id: string) => {
      const snippet = snippets.find((s) => s.id === id);
      if (snippet) {
        setActiveSnippetId(id);
        // Load content into the current mode's editor
        if (mode === "sql") {
          setCurrentSqlQuery(snippet.content);
        } else {
          setCurrentDrizzleQuery(snippet.content);
        }
      }
    },
    [snippets, mode],
  );

  const handleNewSnippet = useCallback(
    async (parentId?: string | null) => {
      if (!activeConnectionId) return;

      let parentFolderId: number | null = null;
      if (parentId && parentId.startsWith("folder-")) {
        parentFolderId = parseInt(parentId.replace("folder-", ""), 10);
      }

      const currentContent = mode === "sql" ? currentSqlQuery : currentDrizzleQuery;
      const name = `Snippet ${snippets.length + 1}`;

      try {
        const res = await adapter.saveScript(
          name,
          currentContent || (mode === "sql" ? "-- New SQL query" : "// New Drizzle query"),
          activeConnectionId,
          null,
          parentFolderId,
        );
        if (res.ok) {
          const newId = res.data.toString();
          await loadSnippets();
          setActiveSnippetId(newId);
          if (parentId) setAutoExpandFolder(parentId);
        }
      } catch (error) {
        console.error("Failed to save snippet:", error);
        notifyFailure("Failed to save snippet", error);
      }
    },
    [
      activeConnectionId,
      snippets.length,
      mode,
      currentSqlQuery,
      currentDrizzleQuery,
      adapter,
      loadSnippets,
    ],
  );

  const handleSaveSnippet = useCallback(async () => {
    if (!activeConnectionId) return;
    const currentContent = mode === "sql" ? currentSqlQuery : currentDrizzleQuery;

    const active = activeSnippetId
      ? snippets.find((s) => s.id === activeSnippetId && !s.isFolder)
      : null;

    if (active) {
      let folderId: number | null = null;
      if (active.parentId?.startsWith("folder-")) {
        folderId = parseInt(active.parentId.replace("folder-", ""), 10);
      }
      try {
        await adapter.updateScript(
          parseInt(active.id, 10),
          active.name,
          currentContent,
          activeConnectionId,
          null,
          folderId,
        );
        await loadSnippets();
      } catch (error) {
        console.error("Failed to update snippet:", error);
        notifyFailure("Failed to update snippet", error);
      }
    } else {
      await handleNewSnippet(null);
    }
  }, [
    activeConnectionId,
    activeSnippetId,
    snippets,
    mode,
    currentSqlQuery,
    currentDrizzleQuery,
    adapter,
    loadSnippets,
    handleNewSnippet,
  ]);

  const handleSaveActiveSnippetFromEditor = useCallback(async () => {
    if (!activeConnectionId || !activeSnippetId) return;
    const active = snippets.find((s) => s.id === activeSnippetId && !s.isFolder);
    if (!active) return;

    let folderId: number | null = null;
    if (active.parentId?.startsWith("folder-")) {
      folderId = parseInt(active.parentId.replace("folder-", ""), 10);
    }

    const currentContent = mode === "sql" ? currentSqlQuery : currentDrizzleQuery;

    try {
      await adapter.updateScript(
        parseInt(active.id, 10),
        active.name,
        currentContent,
        activeConnectionId,
        null,
        folderId,
      );
      await loadSnippets();
    } catch (error) {
      console.error("Failed to update snippet:", error);
      notifyFailure("Failed to update snippet", error);
    }
  }, [
    activeConnectionId,
    activeSnippetId,
    adapter,
    currentDrizzleQuery,
    currentSqlQuery,
    loadSnippets,
    mode,
    snippets,
  ]);

  const handleNewFolder = useCallback(
    async (parentId?: string | null) => {
      // Extract integer ID if parent is a folder
      let parentFolderId: number | null = null;
      if (parentId && parentId.startsWith("folder-")) {
        parentFolderId = parseInt(parentId.replace("folder-", ""), 10);
      }

      const name = "New Folder";
      try {
        const res = await adapter.createSnippetFolder(name, parentFolderId);
        if (res.ok) {
          await loadSnippets();
        }
      } catch (error) {
        console.error("Failed to create folder:", error);
        notifyFailure("Failed to create folder", error);
      }
    },
    [adapter, loadSnippets],
  );

  const handleRenameSnippet = useCallback(
    async (id: string, newName: string) => {
      if (!activeConnectionId && !id.startsWith("folder-")) return;

      if (id.startsWith("folder-")) {
        const folderId = parseInt(id.replace("folder-", ""), 10);
        try {
          await adapter.updateSnippetFolder(folderId, newName);
          await loadSnippets();
        } catch (error) {
          console.error("Failed to rename folder:", error);
          notifyFailure("Failed to rename folder", error);
        }
        return;
      }

      const snippet = snippets.find((s) => s.id === id);
      if (snippet && !snippet.isFolder) {
        let folderId: number | null = null;
        if (snippet.parentId && snippet.parentId.startsWith("folder-")) {
          folderId = parseInt(snippet.parentId.replace("folder-", ""), 10);
        }

        try {
          await adapter.updateScript(
            parseInt(id, 10),
            newName,
            snippet.content,
            activeConnectionId ?? null,
            null,
            folderId,
          );
          await loadSnippets();
        } catch (error) {
          console.error("Failed to rename snippet:", error);
          notifyFailure("Failed to rename snippet", error);
        }
      }
    },
    [activeConnectionId, snippets, adapter, loadSnippets],
  );

  const handleDeleteSnippet = useCallback(
    async (id: string) => {
      if (!activeConnectionId && !id.startsWith("folder-")) return;

      if (id.startsWith("folder-")) {
        const folderId = parseInt(id.replace("folder-", ""), 10);
        try {
          await adapter.deleteSnippetFolder(folderId);
          await loadSnippets();
        } catch (error) {
          console.error("Failed to delete folder:", error);
          notifyFailure("Failed to delete folder", error);
        }
        return;
      }

      try {
        await adapter.deleteScript(parseInt(id, 10));
        await loadSnippets();
      } catch (error) {
        console.error("Failed to delete snippet:", error);
        notifyFailure("Failed to delete snippet", error);
      }
    },
    [activeConnectionId, adapter, loadSnippets],
  );

  const $ = useShortcut();
  const sqlShortcuts = useEffectiveShortcuts();
  useActiveScope($, "sql-console");

  $.bind(sqlShortcuts.runQuery.combo).on(
    function () {
      handleExecute();
    },
    { description: sqlShortcuts.runQuery.description },
  );

  $.bind(sqlShortcuts.runSelection.combo).on(
    function () {
      if (mode === "prisma") return;
      handleExecute(undefined, mode);
    },
    { description: sqlShortcuts.runSelection.description },
  );

  $.bind(sqlShortcuts.openQueryHistory.combo).on(
    function () {
      setShowHistory(function (v) {
        return !v;
      });
    },
    { description: sqlShortcuts.openQueryHistory.description },
  );

  $.bind(sqlShortcuts.aiCmdK.combo).on(
    function () {
      setShowAiCmdK(function (v) {
        return !v;
      });
    },
    { description: sqlShortcuts.aiCmdK.description },
  );

  $.bind(shortcuts.toggleSidebar.combo).on(
    function () {
      toggleRightSidebar();
    },
    { description: shortcuts.toggleSidebar.description },
  );

  $.bind(sqlShortcuts.switchToSql.combo).on(
    function () {
      setMode("sql");
    },
    { description: sqlShortcuts.switchToSql.description },
  );

  $.bind(sqlShortcuts.switchToDrizzle.combo).on(
    function () {
      setMode("drizzle");
    },
    { description: sqlShortcuts.switchToDrizzle.description },
  );

  $.bind(sqlShortcuts.switchToPrisma.combo).on(
    function () {
      setMode("prisma");
    },
    { description: sqlShortcuts.switchToPrisma.description },
  );

  $.key("h")
    .except("typing")
    .on(
      function () {
        setShowHistory(!showHistory);
      },
      { description: "Toggle query history" },
    );

  $.key("v")
    .except("typing")
    .on(
      function () {
        const modes: ResultViewMode[] = ["table", "json", "chart"];
        const currentIndex = modes.indexOf(viewMode);
        setViewMode(modes[(currentIndex + 1) % modes.length]);
      },
      { description: "Cycle result view" },
    );

  // Tab management shortcuts
  $.bind("ctrl+t").on(
    function () {
      tabStore.addTab();
    },
    { description: "New query tab" },
  );

  $.bind("ctrl+w").on(
    function () {
      if (tabStore.tabs.length > 1) {
        tabStore.closeTab(activeTab.id);
      }
    },
    { description: "Close current tab" },
  );

  $.bind("ctrl+tab").on(
    function () {
      tabStore.nextTab();
    },
    { description: "Next tab" },
  );

  $.bind("ctrl+shift+tab").on(
    function () {
      tabStore.prevTab();
    },
    { description: "Previous tab" },
  );

  // Alt+1 through Alt+9 to switch tabs
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (n) {
    $.bind("alt+" + n).on(
      function () {
        tabStore.goToTab(n - 1);
      },
      { description: "Switch to tab " + n },
    );
  });

  return (
    <div className="relative flex h-full w-full bg-background overflow-hidden">
      <PanelGroup direction="horizontal" className="flex-1">
        {showHistory && (
          <>
            <Panel
              defaultSize={15}
              minSize={10}
              maxSize={25}
              collapsible
              onCollapse={function () {
                setShowHistory(false);
              }}
            >
              <QueryHistoryPanel
                currentConnectionId={activeConnectionId}
                getConnectionName={getConnectionName}
                onSelectQuery={function (item) {
                  if (mode === "sql") {
                    setCurrentSqlQuery(item.query);
                  } else {
                    setCurrentDrizzleQuery(item.query);
                  }
                  tabStore.setTabChartConfig(activeTab.id, item.chartConfig ?? null);
                  tabStore.setTabHistoryEntry(activeTab.id, item.id);
                  if (item.chartConfig) {
                    setViewMode("chart");
                  }
                }}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize" />
          </>
        )}

        {/* Main content */}
        <Panel minSize={40}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <ConsoleHeader
              mode={mode}
              onModeChange={setMode}
              connectionName={
                activeConnectionId && getConnectionName
                  ? getConnectionName(activeConnectionId)
                  : undefined
              }
              showHistory={showHistory}
              onToggleHistory={function () {
                setShowHistory(!showHistory);
              }}
            />

            {/* Tab Bar */}
            <QueryTabBar />

            {/* Editor and Results */}
            <div className="flex-1 overflow-hidden">
              {mode === "prisma" ? (
                <PrismaRunner connectionId={activeConnectionId} />
              ) : (
              <ResizablePanels
                defaultSplit={55}
                minSize={100}
                topPanel={
                  <div className="flex flex-col h-full">
                    <div className="relative flex-1 min-h-0">
                    <Suspense fallback={renderEditorFallback()}>
                      {mode === "sql" ? (
                        <SqlEditor
                          value={currentSqlQuery}
                          onChange={setCurrentSqlQuery}
                          onExecute={(code) => handleExecute(code)}
                          onSave={handleSaveActiveSnippetFromEditor}
                          onModeChange={setMode}
                          isExecuting={isExecuting}
                          tables={tables}
                        />
                      ) : (
                        <CodeEditor
                          value={currentDrizzleQuery}
                          onChange={setCurrentDrizzleQuery}
                          onExecute={function (code) {
                            handleExecute(code);
                          }}
                          onSave={handleSaveActiveSnippetFromEditor}
                          onModeChange={setMode}
                          isExecuting={isExecuting}
                          tables={tables.map(function (t) {
                            return {
                              name: t.name,
                              columns: (t.columns || []).map(function (c) {
                                return {
                                  name: c.name,
                                  type: c.type,
                                  nullable: c.nullable ?? false,
                                  primaryKey: c.primaryKey ?? false,
                                };
                              }),
                            };
                          })}
                        />
                      )}
                    </Suspense>
                    </div>
                    <EditorActionBar
                      onToggleRightSidebar={toggleRightSidebar}
                      showRightSidebar={showRightSidebar}
                      isExecuting={isExecuting}
                      onRun={function () {
                        handleExecute();
                      }}
                      onCancel={handleCancel}
                      onPrettify={handlePrettify}
                      onExport={handleExport}
                      onExportCsv={handleExportCsv}
                      hasResults={!!result}
                      showFilter={showFilter}
                      onToggleFilter={function () {
                        setShowFilter(!showFilter);
                      }}
                      onSave={handleSaveSnippet}
                      onExplainQuery={handleExplainQuery}
                      onExplainAnalyze={mode === "sql" ? handleExplainAnalyze : undefined}
                    />
                  </div>
                }
                bottomPanel={
                  <SqlResults
                    result={result}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onExport={handleExport}
                    chartConfig={chartConfig}
                    onChartConfigChange={handleChartConfigChange}
                    connectionId={activeConnectionId}
                    showFilter={showFilter}
                    onRefresh={() => handleExecute()}
                    query={mode === "sql" ? currentSqlQuery : currentDrizzleQuery}
                  />
                }
              />
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <div
        className="flex h-full shrink-0 transition-all duration-200"
        style={{
          width: showRightSidebar ? sidebarWidth : 0,
          overflow: "hidden",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = sbwRef.current;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            function onMove(ev: MouseEvent) {
              sbwRef.current = Math.max(0, Math.min(500, startW - (ev.clientX - startX)));
              setSidebarWidth(sbwRef.current);
            }
            function onUp() {
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
              if (sbwRef.current < 150) setShowRightSidebar(false);
              else setSidebarWidth(sbwRef.current);
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            }
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        />
        <div className="flex-1 h-full bg-sidebar border-l border-sidebar-border">
          <UnifiedSidebar
            snippets={snippets}
            activeSnippetId={activeSnippetId}
            onSnippetSelect={handleSnippetSelect}
            onNewSnippet={handleNewSnippet}
            onNewFolder={handleNewFolder}
            onRenameSnippet={handleRenameSnippet}
            onDeleteSnippet={handleDeleteSnippet}
            autoExpandFolder={autoExpandFolder}
            onAutoExpandDone={() => setAutoExpandFolder(null)}
          />
        </div>
      </div>

      <AiCmdK
        open={showAiCmdK}
        onClose={() => setShowAiCmdK(false)}
        activeConnectionId={activeConnectionId}
        isTauri={isTauri}
        onApplySql={function (sql, _explanation, _warnings, execute) {
          if (mode === "sql") {
            setCurrentSqlQuery(sql);
          } else {
            setCurrentDrizzleQuery(sql);
          }
          if (execute && mode !== "prisma") {
            requestAnimationFrame(function () {
              handleExecute(sql, mode).catch(function (e) {
                console.error("AI insert+run failed:", e);
                notifyFailure("Failed to execute AI SQL", e);
              });
            });
          }
        }}
      />
    </div>
  );
}

function inferPaletteMode(query: string): "sql" | "drizzle" {
  const normalized = query.toLowerCase();

  if (
    normalized.includes("db.select") ||
    normalized.includes("db.insert") ||
    normalized.includes("db.update") ||
    normalized.includes("db.delete") ||
    normalized.includes(".from(")
  ) {
    return "drizzle";
  }

  return "sql";
}
