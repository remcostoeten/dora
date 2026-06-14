import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { ENV_MODE, getEnv } from "@studio/core/env";
import { TooltipProvider } from "@studio/shared/ui/tooltip";
import { useToast } from "@studio/shared/ui/use-toast";
import { useAdapter, useIsTauri } from "@studio/core/data-provider";
import { getAdapterError } from "@studio/core/data-provider/types";
import { commands } from "@studio/lib/bindings";
import { useSettings } from "@studio/core/settings";
import { useEffectiveShortcuts, useShortcut } from "@studio/core/shortcuts";
import { LiveMonitorProvider } from "@studio/core/live-monitor";
import { NavigationSidebar, SidebarProvider } from "@studio/features/app-sidebar";
import { CommandPalette } from "@studio/features/command-palette";
import { scheduleSqlConsoleCommand } from "@studio/features/command-palette/events";
import { useConnections, useConnectionMutations } from "@studio/core/data-provider/hooks";
import {
  backendToFrontendConnection,
  frontendToBackendDatabaseInfo,
} from "@studio/features/connections/utils/mapping";
import { ConnectionDialog } from "@studio/features/connections/components/connection-dialog";
import { Connection } from "@studio/features/connections/types";
import {
  classifyDroppedPaths,
  buildConnectionFromDataFiles,
  buildConnectionFromDatabaseFile,
  resolveDatabaseTypeForPath,
  type DatabaseFileKind,
} from "@studio/features/connections/utils/data-files";
import { useAiAssistantStore } from "@studio/features/ai-assistant/store";
import type { AiAssistantEditorContext } from "@studio/features/ai-assistant/types";
import { Sparkles } from "lucide-react";
import { Button } from "@studio/shared/ui/button";
import { TabsProvider, useTabs } from "@studio/core/tabs";
import { TabBar } from "@studio/features/tab-bar";
const DatabaseStudio = lazy(function () {
  return import("@studio/features/database-studio/database-studio").then(function (m) {
    return { default: m.DatabaseStudio };
  });
});
const DockerView = lazy(function () {
  return import("@studio/features/docker-manager").then(function (m) {
    return { default: m.DockerView };
  });
});
const SqlConsole = lazy(function () {
  return import("@studio/features/sql-console/sql-console").then(function (m) {
    return { default: m.SqlConsole };
  });
});
const SchemaVisualizer = lazy(function () {
  return import("@studio/features/schema-visualizer").then(function (m) {
    return { default: m.SchemaVisualizer };
  });
});
const AiAssistantPanel = lazy(function () {
  return import("@studio/features/ai-assistant/ai-assistant-panel").then(function (m) {
    return { default: m.AiAssistantPanel };
  });
});
import { DatabaseSidebar } from "@studio/features/sidebar/database-sidebar";
import { SettingsView } from "@studio/features/sidebar/components/settings-panel";
import { WindowControls } from "@studio/components/window-controls";
import { ErrorBoundary } from "@studio/shared/ui/error-boundary";
import { mapConnectionError } from "@studio/shared/utils/error-messages";
import { EmptyState } from "@studio/shared/ui/empty-state";
import { ViewLoadingShell } from "@studio/shared/ui/view-loading-shell";
import { Skeleton } from "@studio/shared/ui/skeleton";
import { getTableRefParts } from "@studio/shared/utils/table-ref";
import { Plug } from "lucide-react";

function IndexInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleDatabasePanel = useCallback(function () {
    setIsSidebarOpen(function (open) {
      return !open;
    });
  }, []);
  const { settings, updateSetting, updateSettings, isLoading: isSettingsLoading } = useSettings();

  const { data: connections = [], isLoading: isConnectionsLoading } = useConnections();
  const isLoading = isSettingsLoading || isConnectionsLoading;
  const { addConnection, updateConnection, removeConnection } = useConnectionMutations();
  const isTauri = useIsTauri();

  const urlView = searchParams.get("view");
  const urlTable = searchParams.get("table");
  const urlConnection = searchParams.get("connection");

  const [activeNavId, setActiveNavId] = useState<string>(() => {
    return urlView || "database-studio";
  });

  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
    setActiveTab,
    togglePinTab,
    reorderTab,
    closeTabsForConnection,
  } = useTabs();
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTabConnectionId = activeTab?.connectionId ?? "";

  const autoSelectFirstTableRef = useRef(false);
  const connectionInitializedRef = useRef(false);
  const previousConnectionIdRef = useRef<string>("");

  const [activeConnectionId, setActiveConnectionId] = useState<string>("");
  const [sqlConsoleEditorContext, setSqlConsoleEditorContext] =
    useState<AiAssistantEditorContext | null>(null);
  const selectedTableId =
    activeTab && activeTabConnectionId === activeConnectionId ? activeTab.tableId : "";
  const selectedTableName =
    activeTab && activeTabConnectionId === activeConnectionId ? activeTab.tableName : "";
  const studioConnectionId = activeConnectionId;
  const sidebarSelectedTableId = selectedTableId;

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [connectionDialogDroppedPaths, setConnectionDialogDroppedPaths] = useState<
    string[] | null
  >(null);
  const [connectionDialogDragActive, setConnectionDialogDragActive] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);
  const isConnectionDialogOpenRef = useRef(isConnectionDialogOpen);

  const startupConnectionMode =
    settings.startupConnectionMode ?? (settings.restoreLastConnection ? "auto" : "empty");

  const { toast } = useToast();
  const shortcuts = useEffectiveShortcuts();
  const toggleAiAssistant = useAiAssistantStore(function (s) {
    return s.toggleOpen;
  });
  const paletteShortcut = useShortcut({ ignoreInputs: false });
  const $ = useShortcut();

  paletteShortcut.bind(shortcuts.openCommandPalette.combo).on(
    function () {
      setIsCommandPaletteOpen(function (open) {
        return !open;
      });
    },
    { description: shortcuts.openCommandPalette.description },
  );

  $.bind(shortcuts.newConnection.combo).on(
    function () {
      setIsConnectionDialogOpen(true);
    },
    { description: shortcuts.newConnection.description },
  );

  useEffect(
    function syncConnectionDialogOpenRef() {
      isConnectionDialogOpenRef.current = isConnectionDialogOpen;
    },
    [isConnectionDialogOpen],
  );

  async function probeDatabaseFileKind(path: string): Promise<DatabaseFileKind> {
    if (!isTauri) return "unknown";
    const result = await commands.probeDatabaseFile(path);
    if (result.status === "ok") {
      return result.data;
    }
    return "unknown";
  }

  async function resolveDatabaseType(path: string) {
    return resolveDatabaseTypeForPath(path, probeDatabaseFileKind);
  }

  $.bind(shortcuts.toggleSidebar.combo).on(toggleDatabasePanel, {
    description: shortcuts.toggleSidebar.description,
  });

  $.bind(shortcuts.toggleAiAssistant.combo).on(
    function () {
      toggleAiAssistant();
    },
    { description: shortcuts.toggleAiAssistant.description },
  );

  $.bind(shortcuts.reconnect.combo).on(
    function () {
      if (activeConnectionId) handleConnectionSelect(activeConnectionId);
    },
    { description: shortcuts.reconnect.description },
  );

  // Go-to chord sequences — except 'typing' so Monaco doesn't intercept
  $.bind(shortcuts.gotoDashboard.combo)
    .except("typing")
    .on(
      function () {
        setActiveNavId("database-studio");
      },
      { description: shortcuts.gotoDashboard.description },
    );

  $.bind(shortcuts.gotoSettings.combo)
    .except("typing")
    .on(
      function () {
        setActiveNavId("settings");
      },
      { description: shortcuts.gotoSettings.description },
    );

  $.bind(shortcuts.gotoConnections.combo)
    .except("typing")
    .on(
      function () {
        setActiveNavId("connections");
      },
      { description: shortcuts.gotoConnections.description },
    );

  useEffect(
    function syncCaptureReady() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("capture") !== "1") return;

      window.__DORA_CAPTURE_MODE = true;

      if (isLoading) {
        document.documentElement.removeAttribute("data-dora-capture-ready");
        return;
      }

      const timer = window.setTimeout(function () {
        document.documentElement.dataset.doraCaptureReady = "true";
        window.__DORA_CAPTURE_READY_AT = performance.now();
      }, 500);

      return function () {
        window.clearTimeout(timer);
        document.documentElement.removeAttribute("data-dora-capture-ready");
      };
    },
    [isLoading, activeNavId],
  );

  $.bind(shortcuts.gotoEditor.combo)
    .except("typing")
    .on(
      function () {
        setActiveNavId("sql-console");
      },
      { description: shortcuts.gotoEditor.description },
    );

  $.bind(shortcuts.gotoDocker.combo)
    .except("typing")
    .on(
      function () {
        setActiveNavId("docker");
      },
      { description: shortcuts.gotoDocker.description },
    );

  // Connection switching by index (1-9)
  connections.slice(0, 9).forEach(function (conn, i) {
    const key = `switchConnection${i + 1}` as keyof typeof shortcuts;
    const def = shortcuts[key];
    if (def) {
      $.bind(def.combo).on(
        function () {
          handleConnectionSelect(conn.id);
        },
        { description: def.description },
      );
    }
  });

  useEffect(function () {
    // Initial load is handled by useConnections
  }, []);

  const isUpdatingUrlRef = useRef(false);

  useEffect(
    function syncUrlParams() {
      if (isUpdatingUrlRef.current) return;

      const currentView = searchParams.get("view");
      const currentTable = searchParams.get("table");
      const currentConnection = searchParams.get("connection");

      const viewChanged = activeNavId && currentView !== activeNavId;
      const tableChanged = selectedTableId && currentTable !== selectedTableId;
      const connectionChanged = activeConnectionId && currentConnection !== activeConnectionId;

      if (!viewChanged && !tableChanged && !connectionChanged) return;

      const params = new URLSearchParams();

      if (activeNavId) params.set("view", activeNavId);
      if (selectedTableId) params.set("table", selectedTableId);
      if (activeConnectionId) params.set("connection", activeConnectionId);

      isUpdatingUrlRef.current = true;
      setSearchParams(params, { replace: true });
      requestAnimationFrame(function () {
        isUpdatingUrlRef.current = false;
      });
    },
    [activeNavId, selectedTableId, activeConnectionId, setSearchParams],
  );

  useEffect(
    function initializeConnection() {
      if (isSettingsLoading || isConnectionsLoading) return;
      if (connections.length === 0) return;
      if (connectionInitializedRef.current) return;

      if (urlConnection) {
        setActiveConnectionId(urlConnection);
        autoSelectFirstTableRef.current = true;
        connectionInitializedRef.current = true;
        return;
      }

      if (activeConnectionId) {
        connectionInitializedRef.current = true;
        return;
      }

      if (startupConnectionMode === "empty") {
        connectionInitializedRef.current = true;
        return;
      }

      if (settings.lastConnectionId) {
        const lastConnection = connections.find(function (c) {
          return c.id === settings.lastConnectionId;
        });
        if (lastConnection) {
          setActiveConnectionId(lastConnection.id);
          if (settings.lastTableId) {
            openTab({
              connectionId: lastConnection.id,
              tableId: settings.lastTableId,
              tableName: getTableRefParts(settings.lastTableId).tableName,
              label: getTableRefParts(settings.lastTableId).tableName,
            });
          }
          autoSelectFirstTableRef.current = true;
          connectionInitializedRef.current = true;
          return;
        }
      }

      const isTauriRuntime =
        window.location.protocol === "tauri:" ||
        "__TAURI__" in window ||
        "__TAURI_INTERNALS__" in window;
      const isWebDemo =
        !isTauriRuntime &&
        (ENV_MODE === "demo" ||
          window.location.hostname.includes("demo") ||
          getEnv("VITE_IS_WEB") === "true");

      if (isWebDemo) {
        const demoConn =
          connections.find(function (c) {
            return c.id === "demo-ecommerce-001";
          }) || connections[0];
        if (demoConn) {
          setActiveConnectionId(demoConn.id);
          autoSelectFirstTableRef.current = true;
          connectionInitializedRef.current = true;
          return;
        }
      }

      const firstConnection = connections[0];
      if (firstConnection) {
        setActiveConnectionId(firstConnection.id);
        autoSelectFirstTableRef.current = true;
        connectionInitializedRef.current = true;
      }
    },
    [
      isSettingsLoading,
      isConnectionsLoading,
      connections,
      urlConnection,
      activeConnectionId,
      startupConnectionMode,
      settings.restoreLastConnection,
      settings.lastConnectionId,
      settings.lastTableId,
      openTab,
    ],
  );

  useEffect(
    function saveLastConnection() {
      if (!activeConnectionId || isSettingsLoading) return;

      const updates: Partial<typeof settings> = {};
      let hasUpdates = false;

      if (settings.lastConnectionId !== activeConnectionId) {
        updates.lastConnectionId = activeConnectionId;
        hasUpdates = true;
      }

      if (selectedTableId && settings.lastTableId !== selectedTableId) {
        updates.lastTableId = selectedTableId;
        hasUpdates = true;
      }

      if (hasUpdates) {
        updateSettings(updates);
      }
    },
    [
      activeConnectionId,
      selectedTableId,
      isSettingsLoading,
      settings.lastConnectionId,
      settings.lastTableId,
      updateSettings,
    ],
  );

  async function handleAddConnection(connection: Omit<Connection, "id" | "status" | "createdAt">) {
    try {
      const dbInfo = frontendToBackendDatabaseInfo(connection as Connection);
      const newConnection = await addConnection.mutateAsync({
        name: connection.name,
        databaseType: dbInfo,
      });
      setIsConnectionDialogOpen(false);
      setActiveConnectionId(newConnection.id);
      autoSelectFirstTableRef.current = true;
      toast({
        title: "Connection Added",
        description: `"${connection.name}" has been created and connected.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to Add Connection",
        description: mapConnectionError(
          error instanceof Error ? error : new Error("Unknown error"),
        ),
        variant: "destructive",
      });
    }
  }

  async function handleOpenDataFiles(paths: string[]) {
    const dataFiles = classifyDroppedPaths(paths).dataFiles;
    if (dataFiles.length === 0) return;
    await handleAddConnection(buildConnectionFromDataFiles(dataFiles));
  }

  async function handleOpenDatabaseFile(path: string) {
    const type = await resolveDatabaseType(path);
    await handleAddConnection(buildConnectionFromDatabaseFile(path, type));
  }

  async function processImmediateFileDrop(paths: string[]) {
    const { dataFiles, databaseFiles, unsupported } = classifyDroppedPaths(paths);

    if (unsupported.length > 0) {
      toast({
        title: "Unsupported file type",
        description: `Could not open: ${unsupported.map(function (p) {
          return p.split(/[\\/]/).pop() ?? p;
        }).join(", ")}`,
        variant: "destructive",
      });
    }

    if (dataFiles.length > 0) {
      await handleOpenDataFiles(dataFiles);
    }

    for (const path of databaseFiles) {
      await handleOpenDatabaseFile(path);
    }
  }

  async function handlePickDataFiles() {
    try {
      const result = await commands.openDataFiles();
      if (result.status === "ok" && result.data.length > 0) {
        await handleOpenDataFiles(result.data);
      }
    } catch (error) {
      toast({
        title: "Failed to open data files",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  }

  // Keep the latest handlers reachable from the drag-drop listener, which is
  // subscribed once (per Tauri availability) and would otherwise close over
  // stale mutation references.
  const dropHandlerRef = useRef<(paths: string[]) => void>(function () {});
  dropHandlerRef.current = function (paths) {
    if (isConnectionDialogOpenRef.current) {
      setConnectionDialogDroppedPaths(paths);
      return;
    }
    void processImmediateFileDrop(paths);
  };

  useEffect(
    function subscribeToFileDrop() {
      if (!isTauri) return;
      let unlisten: (() => void) | undefined;
      let cancelled = false;

      import("@tauri-apps/api/webview")
        .then(function ({ getCurrentWebview }) {
          return getCurrentWebview().onDragDropEvent(function (event) {
            if (event.payload.type === "over") {
              if (isConnectionDialogOpenRef.current) {
                setConnectionDialogDragActive(true);
              }
              return;
            }
            if (event.payload.type === "leave") {
              setConnectionDialogDragActive(false);
              return;
            }
            if (event.payload.type === "drop") {
              setConnectionDialogDragActive(false);
              dropHandlerRef.current(event.payload.paths ?? []);
            }
          });
        })
        .then(function (fn) {
          if (cancelled) fn();
          else unlisten = fn;
        })
        .catch(function () {
          /* drag-drop is a desktop-only nicety; ignore when unavailable */
        });

      return function () {
        cancelled = true;
        unlisten?.();
      };
    },
    [isTauri],
  );

  async function handleUpdateConnection(
    connection: Omit<Connection, "id" | "status" | "createdAt">,
  ) {
    if (!editingConnection) return;
    try {
      const dbInfo = frontendToBackendDatabaseInfo(connection as Connection);
      await updateConnection.mutateAsync({
        id: editingConnection.id,
        name: connection.name,
        databaseType: dbInfo,
      });
      setIsConnectionDialogOpen(false);
      setEditingConnection(undefined);
      toast({
        title: "Connection Updated",
        description: `"${connection.name}" has been updated.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to Update Connection",
        description: mapConnectionError(
          error instanceof Error ? error : new Error("Unknown error"),
        ),
        variant: "destructive",
      });
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    const connection = connections.find(function (c) {
      return c.id === connectionId;
    });
    if (!connection) return;
    try {
      await removeConnection.mutateAsync(connection.id);
      if (activeConnectionId === connection.id) {
        setActiveConnectionId("");
      }
      closeTabsForConnection(connection.id);
      toast({
        title: "Connection Deleted",
        description: `"${connection.name}" has been removed.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to Delete Connection",
        description: mapConnectionError(
          error instanceof Error ? error : new Error("Unknown error"),
        ),
        variant: "destructive",
      });
    }
  }

  async function handleConnectionSelect(connectionId: string) {
    setActiveConnectionId(connectionId);
    autoSelectFirstTableRef.current = false;
  }

  const handleTabClick = useCallback(
    function (tabId: string) {
      const tab = tabs.find(function (candidate) {
        return candidate.id === tabId;
      });
      if (tab && tab.connectionId !== activeConnectionId) {
        setActiveConnectionId(tab.connectionId);
      }
      setActiveTab(tabId);
    },
    [activeConnectionId, setActiveTab, tabs],
  );

  function handleViewConnection(connectionId: string) {
    const connection = connections.find(function (c) {
      return c.id === connectionId;
    });
    if (connection) {
      setEditingConnection(connection);
      setIsConnectionDialogOpen(true);
    }
  }

  function handleEditConnection(connectionId: string) {
    const connection = connections.find(function (c) {
      return c.id === connectionId;
    });
    if (connection) {
      setEditingConnection(connection);
      setIsConnectionDialogOpen(true);
    }
  }

  function handleOpenNewConnection() {
    setEditingConnection(undefined);
    setIsConnectionDialogOpen(true);
  }

  async function handleDialogSave(connectionData: Omit<Connection, "id" | "createdAt">) {
    if (editingConnection) {
      await handleUpdateConnection(connectionData);
    } else {
      await handleAddConnection(connectionData);
    }
  }

  const handleTableSelect = useCallback(
    function (id: string, name: string) {
      if (!activeConnectionId) return;
      openTab({
        connectionId: activeConnectionId,
        tableId: id,
        tableName: name,
        label: name,
      });
    },
    [activeConnectionId, openTab],
  );

  const handleAutoSelectComplete = useCallback(function () {
    autoSelectFirstTableRef.current = false;
  }, []);

  const navigateToSqlConsole =
    activeNavId === "sql-console" ? undefined : function () {
      setActiveNavId("sql-console");
    };

  const handleInsertSqlInConsole = useCallback(
    function (sql: string) {
      scheduleSqlConsoleCommand(
        { type: "load-query", query: sql, mode: "sql", execute: false },
        navigateToSqlConsole ? { navigate: navigateToSqlConsole } : undefined,
      );
    },
    [activeNavId],
  );

  const handleRunSqlInConsole = useCallback(
    function (sql: string) {
      scheduleSqlConsoleCommand(
        { type: "load-query", query: sql, mode: "sql", execute: true },
        navigateToSqlConsole ? { navigate: navigateToSqlConsole } : undefined,
      );
    },
    [activeNavId],
  );

  useEffect(
    function clearTabsFromPreviousConnection() {
      const previousConnectionId = previousConnectionIdRef.current;
      if (previousConnectionId && previousConnectionId !== activeConnectionId) {
        closeTabsForConnection(previousConnectionId);
      }

      previousConnectionIdRef.current = activeConnectionId;
    },
    [activeConnectionId, closeTabsForConnection],
  );

  // Show database panel for sql-console and database-studio views
  const showDatabasePanel =
    activeNavId === "sql-console" ||
    activeNavId === "database-studio" ||
    activeNavId === "schema-visualizer";
  const paletteActiveNavId =
    activeNavId === "docker" || activeNavId === "sql-console" || activeNavId === "settings"
      ? activeNavId
      : "database-studio";

  return (
    <LiveMonitorProvider activeConnectionId={activeConnectionId || undefined}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
              <NavigationSidebar
                activeNavId={activeNavId}
                onNavSelect={setActiveNavId}
                databasePanelToggle={
                  showDatabasePanel
                    ? {
                        isOpen: isSidebarOpen,
                        onToggle: toggleDatabasePanel,
                      }
                    : undefined
                }
              />

              {showDatabasePanel && isSidebarOpen && (
                <DatabaseSidebar
                  activeNavId={activeNavId}
                  onNavSelect={setActiveNavId}
                  onTableSelect={handleTableSelect}
                  selectedTableId={sidebarSelectedTableId}
                  autoSelectFirstTable={autoSelectFirstTableRef.current}
                  onAutoSelectComplete={handleAutoSelectComplete}
                  connections={connections}
                  activeConnectionId={activeConnectionId}
                  onConnectionSelect={handleConnectionSelect}
                  onAddConnection={handleOpenNewConnection}
                  onManageConnections={function () {
                    const activeConn = connections.find(function (c) {
                      return c.id === activeConnectionId;
                    });
                    if (activeConn) {
                      setEditingConnection(activeConn);
                      setIsConnectionDialogOpen(true);
                    }
                  }}
                  onViewConnection={handleViewConnection}
                  onEditConnection={handleEditConnection}
                  onDeleteConnection={handleDeleteConnection}
                />
              )}

              <main className="flex-1 flex flex-col h-full overflow-hidden relative px-0">
                <Suspense
                  fallback={
                    <ViewLoadingShell
                      view={
                        activeNavId === "sql-console" ||
                        activeNavId === "schema-visualizer" ||
                        activeNavId === "docker"
                          ? activeNavId
                          : "database-studio"
                      }
                    />
                  }
                >
                  {connections.length === 0 &&
                  !isLoading &&
                  (activeNavId === "database-studio" || activeNavId === "sql-console") ? (
                    <div className="flex flex-col flex-1 min-h-0">
                      <TabBar
                        tabs={[]}
                        activeTabId={null}
                        onTabClick={function () {}}
                        onTabClose={function () {}}
                        rightSlot={<WindowControls />}
                      />
                      <EmptyState
                        icon={<Plug className="h-16 w-16" />}
                        title="No Connections"
                        description="Add a database connection to start exploring your data."
                        action={{
                          label: "Add Connection",
                          onClick: handleOpenNewConnection,
                        }}
                      />
                    </div>
                  ) : activeNavId === "database-studio" ? (
                    <div className="flex flex-col flex-1 min-h-0">
                      <TabBar
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onTabClick={handleTabClick}
                        onTabClose={closeTab}
                        onTabPinToggle={togglePinTab}
                        onCloseOtherTabs={closeOtherTabs}
                        onCloseTabsToLeft={closeTabsToLeft}
                        onCloseTabsToRight={closeTabsToRight}
                        onTabReorder={reorderTab}
                        rightSlot={<WindowControls />}
                      />
                      <ErrorBoundary feature="Database Studio">
                        <DatabaseStudio
                          key={studioConnectionId || "empty"}
                          tableId={selectedTableId}
                          tableName={selectedTableName}
                          initialRowPK={settings.lastRowPK}
                          onRowSelectionChange={function (pk) {
                            if (pk !== settings.lastRowPK) {
                              updateSetting("lastRowPK", pk);
                            }
                          }}
                          activeConnectionId={studioConnectionId}
                          onConnectionSelect={setActiveConnectionId}
                          onAddConnection={handleOpenNewConnection}
                          onEditConnection={
                            studioConnectionId
                              ? function () {
                                  handleEditConnection(studioConnectionId);
                                }
                              : undefined
                          }
                        />
                      </ErrorBoundary>
                    </div>
                  ) : activeNavId === "sql-console" ? (
                    <ErrorBoundary feature="SQL Console">
                      <SqlConsole
                        activeConnectionId={activeConnectionId}
                        onEditorContextChange={setSqlConsoleEditorContext}
                        getConnectionName={function (id) {
                          return (
                            connections.find(function (c) {
                              return c.id === id;
                            })?.name ?? id.slice(0, 8)
                          );
                        }}
                      />
                    </ErrorBoundary>
                  ) : activeNavId === "schema-visualizer" ? (
                    <ErrorBoundary feature="Schema Visualizer">
                      <SchemaVisualizer
                        activeConnectionId={activeConnectionId}
                        selectedTableId={selectedTableId}
                        onSelectTable={handleTableSelect}
                        onOpenTable={function (tableId, tableName) {
                          handleTableSelect(tableId, tableName);
                          setActiveNavId("database-studio");
                        }}
                        windowControls={<WindowControls />}
                      />
                    </ErrorBoundary>
                  ) : activeNavId === "settings" ? (
                    <ErrorBoundary feature="Settings">
                      <SettingsView windowControls={<WindowControls />} />
                    </ErrorBoundary>
                  ) : activeNavId === "docker" ? (
                    <ErrorBoundary feature="Docker Manager">
                      <DockerView
                        windowControls={<WindowControls />}
                        onOpenInDataViewer={async function (container) {
                          const userEnv = container.env.find(function (e) {
                            return e.startsWith("POSTGRES_USER=");
                          });
                          const passEnv = container.env.find(function (e) {
                            return e.startsWith("POSTGRES_PASSWORD=");
                          });
                          const dbEnv = container.env.find(function (e) {
                            return e.startsWith("POSTGRES_DB=");
                          });
                          const primaryPort = container.ports.find(function (p) {
                            return p.containerPort === 5432;
                          });

                          const user = userEnv ? userEnv.split("=")[1] : "postgres";
                          const password = passEnv ? passEnv.split("=")[1] : "postgres";
                          const database = dbEnv ? dbEnv.split("=")[1] : "postgres";
                          const port = primaryPort ? primaryPort.hostPort : 5432;

                          const connectionData = {
                            name: container.name,
                            type: "postgres" as const,
                            host: "localhost",
                            port,
                            user,
                            password,
                            database,
                          };

                          await handleAddConnection(connectionData);
                          setActiveNavId("database-studio");
                        }}
                      />
                    </ErrorBoundary>
                  ) : (
                    <ErrorBoundary feature="SQL Console">
                      <SqlConsole
                        activeConnectionId={activeConnectionId}
                        onEditorContextChange={setSqlConsoleEditorContext}
                        getConnectionName={function (id) {
                          return (
                            connections.find(function (c) {
                              return c.id === id;
                            })?.name ?? id.slice(0, 8)
                          );
                        }}
                      />
                    </ErrorBoundary>
                  )}
                </Suspense>
              </main>

              <ConnectionDialog
                open={isConnectionDialogOpen}
                onOpenChange={function (open) {
                  setIsConnectionDialogOpen(open);
                  if (!open) {
                    setEditingConnection(undefined);
                    setConnectionDialogDroppedPaths(null);
                    setConnectionDialogDragActive(false);
                  }
                }}
                onSave={handleDialogSave}
                droppedFilePaths={connectionDialogDroppedPaths}
                externalDropActive={connectionDialogDragActive}
                onDroppedFilePathsHandled={function () {
                  setConnectionDialogDroppedPaths(null);
                }}
                onOpenDataFiles={
                  isTauri
                    ? async function (paths?: string[]) {
                        if (paths && paths.length > 0) {
                          setIsConnectionDialogOpen(false);
                          await handleOpenDataFiles(paths);
                          return;
                        }
                        setIsConnectionDialogOpen(false);
                        await handlePickDataFiles();
                      }
                    : undefined
                }
                resolveDatabaseType={resolveDatabaseType}
                initialValues={editingConnection}
              />

              <CommandPalette
                open={isCommandPaletteOpen}
                onOpenChange={setIsCommandPaletteOpen}
                activeNavId={paletteActiveNavId}
                onNavigate={setActiveNavId}
                connections={connections}
                activeConnectionId={activeConnectionId}
                selectedTableId={selectedTableId}
                onSelectConnection={handleConnectionSelect}
                onCreateConnection={handleOpenNewConnection}
                onEditConnection={handleEditConnection}
                onDeleteConnection={handleDeleteConnection}
                onSelectTable={handleTableSelect}
              />

              <AiAssistantToggle />
              <AiAssistantPanelHost
                activeConnectionId={activeConnectionId || null}
                activeView={activeNavId}
                selectedTableId={selectedTableId || null}
                selectedTableName={selectedTableName || null}
                editorContext={activeNavId === "sql-console" ? sqlConsoleEditorContext : null}
                onEditorInsert={handleInsertSqlInConsole}
                onRunInConsole={handleRunSqlInConsole}
              />
            </div>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </LiveMonitorProvider>
  );
}

export default function Index() {
  return (
    <TabsProvider>
      <IndexInner />
    </TabsProvider>
  );
}

function AiAssistantToggle() {
  const open = useAiAssistantStore(function (s) {
    return s.open;
  });
  const toggleOpen = useAiAssistantStore(function (s) {
    return s.toggleOpen;
  });
  if (open) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleOpen}
      title="Open AI assistant"
      className="fixed bottom-4 right-4 z-[70] h-10 w-10 rounded-full shadow-lg"
    >
      <Sparkles className="h-4 w-4" />
    </Button>
  );
}

function AiAssistantPanelHost(props: {
  activeConnectionId: string | null;
  activeView: string;
  selectedTableId: string | null;
  selectedTableName: string | null;
  editorContext: AiAssistantEditorContext | null;
  onEditorInsert?: (sql: string) => void;
  onRunInConsole?: (sql: string) => void;
}) {
  const open = useAiAssistantStore(function (s) {
    return s.open;
  });
  if (!open) return null;

  return (
    <Suspense
      fallback={
        <div className="fixed bottom-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background/95 p-3 shadow-lg">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-9 w-full" />
        </div>
      }
    >
      <AiAssistantPanel {...props} />
    </Suspense>
  );
}
