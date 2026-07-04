import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { ENV_MODE, getEnv } from "@studio/core/env";
import { useToast } from "@studio/shared/ui/use-toast";
import { useAdapter, useIsTauri } from "@studio/core/data-provider";
import { getAdapterError } from "@studio/core/data-provider/types";
import { commands } from "@studio/lib/bindings";
import { useSettings } from "@studio/core/settings";
import { useEffectiveShortcuts, useShortcut, formatShortcut } from "@studio/core/shortcuts";
import {
  zoomIn,
  zoomOut,
  resetZoom,
  initZoom,
  toggleFullscreen,
} from "@studio/shared/lib/ui-zoom";
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
import { getContainerConnectionDetails } from "@studio/features/docker-manager/utilities/container-connection";
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
import { ConnectionTabBar } from "@studio/features/connection-tab-bar";
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
const OrmCockpitPanel = lazy(function () {
  return import(
    "@studio/features/orm-cockpit/components/orm-cockpit-panel"
  ).then(function (m) {
    return { default: m.OrmCockpitPanel };
  });
});
const AiAssistantPanel = lazy(function () {
  return import("@studio/features/ai-assistant/ai-assistant-panel").then(function (m) {
    return { default: m.AiAssistantPanel };
  });
});
import { DatabaseSidebar } from "@studio/features/sidebar/database-sidebar";
import { SettingsView, type SettingsSectionId } from "@studio/features/sidebar/components/settings-panel";
import { WindowControls } from "@studio/components/window-controls";
import { ErrorBoundary } from "@studio/shared/ui/error-boundary";
import { mapConnectionError } from "@studio/shared/utils/error-messages";
import { ViewLoadingShell } from "@studio/shared/ui/view-loading-shell";
import { Skeleton } from "@studio/shared/ui/skeleton";
import { getTableRefParts } from "@studio/shared/utils/table-ref";

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
  const { addConnection, updateConnection, removeConnection, disconnectFromDatabase } =
    useConnectionMutations();
  const isTauri = useIsTauri();

  const urlView = searchParams.get("view");
  const urlTable = searchParams.get("table");
  const urlConnection = searchParams.get("connection");

  const [activeNavId, setActiveNavId] = useState<string>(() => {
    return urlView || "database-studio";
  });
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId | undefined>();
  const [settingsHighlightSection, setSettingsHighlightSection] = useState<SettingsSectionId | undefined>();

  const {
    tabs,
    visibleTabs,
    activeTabId,
    activeConnectionId,
    openConnectionIds,
    openTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
    setActiveTab,
    togglePinTab,
    reorderTab,
    closeTabsForConnection,
    hydrateSession,
    setActiveConnection,
    openConnection,
    closeConnection,
  } = useTabs();
  const sessionHydratedRef = useRef(false);

  // Restore tabs persisted from the last session (issue #98). Tabs render
  // synchronously from storage on first paint; this one-shot effect prunes them
  // once we know the user's preference and which connections still exist:
  // unpinned tabs are dropped when "restore on launch" is off, and any tab whose
  // connection no longer exists is dropped. Pinned tabs always restore.
  useEffect(
    function hydrateTabSessionOnce() {
      if (sessionHydratedRef.current) return;
      if (isSettingsLoading || isConnectionsLoading) return;
      sessionHydratedRef.current = true;
      hydrateSession({
        restoreUnpinned: settings.restoreTabsOnLaunch,
        knownConnectionIds: new Set(connections.map((c) => c.id)),
      });
    },
    [
      isSettingsLoading,
      isConnectionsLoading,
      settings.restoreTabsOnLaunch,
      connections,
      hydrateSession,
    ],
  );
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTabConnectionId = activeTab?.connectionId ?? "";

  const autoSelectFirstTableRef = useRef(false);
  const connectionInitializedRef = useRef(false);

  // `activeConnectionId` now lives in the tabs store so each connection keeps its
  // own tab group (issue #96). This bridge keeps the existing call sites that
  // expect a setter working: selecting a connection opens + activates it, and
  // passing "" is a no-op (use closeConnection to actually close one).
  const setActiveConnectionId = useCallback(
    function (connectionId: string) {
      if (connectionId) setActiveConnection(connectionId);
    },
    [setActiveConnection],
  );
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
      if (isConnectionDialogOpenRef.current) {
        setIsConnectionDialogOpen(false);
        setEditingConnection(undefined);
        setConnectionDialogDroppedPaths(null);
        setConnectionDialogDragActive(false);
      } else {
        setIsConnectionDialogOpen(true);
      }
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
        handleOpenSettings();
      },
      { description: shortcuts.gotoSettings.description },
    );

  $.bind(shortcuts.openSettings.combo)
    .except("typing")
    .on(
      function () {
        handleOpenSettings();
      },
      { description: shortcuts.openSettings.description },
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

  // Cycle through open connection tab groups (issue #96).
  $.bind(shortcuts.prevConnection.combo)
    .except("typing")
    .on(
      function () {
        cycleConnection(-1);
      },
      { description: shortcuts.prevConnection.description },
    );
  $.bind(shortcuts.nextConnection.combo)
    .except("typing")
    .on(
      function () {
        cycleConnection(1);
      },
      { description: shortcuts.nextConnection.description },
    );

  // View: zoom + fullscreen. `except('typing')` lets the SQL editor keep
  // mod+enter for "run query" and stops zoom keys firing inside inputs.
  useEffect(function applyPersistedZoom() {
    initZoom();
  }, []);

  $.bind(shortcuts.zoomIn.combo).on(
    function () {
      zoomIn();
    },
    { description: shortcuts.zoomIn.description },
  );
  $.bind(shortcuts.zoomOut.combo).on(
    function () {
      zoomOut();
    },
    { description: shortcuts.zoomOut.description },
  );
  $.bind(shortcuts.zoomReset.combo).on(
    function () {
      resetZoom();
    },
    { description: shortcuts.zoomReset.description },
  );
  $.bind(shortcuts.toggleFullscreen.combo)
    .except("typing")
    .on(
      function () {
        toggleFullscreen();
      },
      { description: shortcuts.toggleFullscreen.description },
    );

  $.bind(shortcuts.quitApp.combo).on(
    function () {
      if (isTauri) {
        commands.closeWindow();
      }
    },
    { description: shortcuts.quitApp.description },
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
      // Removing a connection also closes its tab group and clears it as active.
      closeConnection(connection.id);
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
    setActiveConnection(connectionId);
    autoSelectFirstTableRef.current = settings.startupConnectionMode === 'auto';
  }

  function handleOpenSettings(
    section?: SettingsSectionId,
    options?: { highlight?: SettingsSectionId },
  ) {
    setSettingsInitialSection(section);
    setSettingsHighlightSection(options?.highlight);
    setActiveNavId("settings");
  }

  // Close a connection tab (issue #96): disconnect its backend session and drop
  // its tab group. The store picks the nearest remaining connection as active,
  // or the empty state when none remain. The connection itself is NOT deleted —
  // it stays in the saved connection list and can be reopened.
  function handleCloseConnection(connectionId: string) {
    closeConnection(connectionId);
    closeTabsForConnection(connectionId);
    disconnectFromDatabase.mutate(connectionId);
  }

  function handleCloseOtherConnections(connectionId: string) {
    const idsToClose = openConnectionIds.filter(function (id) {
      return id !== connectionId;
    });
    idsToClose.forEach(function (id) {
      handleCloseConnection(id);
    });
    setActiveConnection(connectionId);
  }

  function handleCloseConnectionsToLeft(connectionId: string) {
    const connectionIndex = openConnectionIds.indexOf(connectionId);
    if (connectionIndex <= 0) return;

    openConnectionIds.slice(0, connectionIndex).forEach(function (id) {
      handleCloseConnection(id);
    });
    setActiveConnection(connectionId);
  }

  function handleCloseConnectionsToRight(connectionId: string) {
    const connectionIndex = openConnectionIds.indexOf(connectionId);
    if (connectionIndex < 0 || connectionIndex >= openConnectionIds.length - 1) return;

    openConnectionIds.slice(connectionIndex + 1).forEach(function (id) {
      handleCloseConnection(id);
    });
    setActiveConnection(connectionId);
  }

  // Cycle through open connection tabs (Ctrl+Shift+[ / Ctrl+Shift+]).
  const cycleConnection = useCallback(
    function (direction: 1 | -1) {
      if (openConnectionIds.length < 2) return;
      const currentIndex = openConnectionIds.indexOf(activeConnectionId);
      const baseIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex =
        (baseIndex + direction + openConnectionIds.length) % openConnectionIds.length;
      setActiveConnection(openConnectionIds[nextIndex]);
    },
    [openConnectionIds, activeConnectionId, setActiveConnection],
  );

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

  const handleConnectionDialogOpenChange = useCallback(
    function (open: boolean) {
      setIsConnectionDialogOpen(open);
      if (!open) {
        setEditingConnection(undefined);
        setConnectionDialogDroppedPaths(null);
        setConnectionDialogDragActive(false);
      }
    },
    [],
  );

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

  // Issue #96: switching connections no longer tears down the previous
  // connection's tabs — each connection keeps its own isolated tab group. The
  // table TabBar renders only the active connection's tabs (`visibleTabs`), so
  // switching simply changes which group is shown and naturally preserves each
  // connection's open tabs, active tab, filter and scroll state.

  // Show database panel for sql-console and database-studio views
  const showDatabasePanel =
    activeNavId === "sql-console" ||
    activeNavId === "database-studio" ||
    activeNavId === "schema-visualizer";
  const paletteActiveNavId =
    activeNavId === "docker" || activeNavId === "sql-console" || activeNavId === "settings"
      ? activeNavId
      : "database-studio";

  // The connections the user has open, resolved to full Connection objects in
  // the order their connection tabs appear (issue #96). Stale ids (a connection
  // deleted elsewhere) are filtered out.
  const openConnections = openConnectionIds
    .map(function (id) {
      return connections.find(function (c) {
        return c.id === id;
      });
    })
    .filter(function (c): c is Connection {
      return Boolean(c);
    });
  const showConnectionTabBar =
    openConnections.length > 0 &&
    (activeNavId === "database-studio" || activeNavId === "sql-console");

  const connectionTabBar = showConnectionTabBar ? (
    <ConnectionTabBar
      connections={openConnections}
      activeConnectionId={activeConnectionId}
      onSelect={handleConnectionSelect}
      onClose={handleCloseConnection}
      onViewConnection={handleViewConnection}
      onEditConnection={handleEditConnection}
      onCloseOtherConnections={handleCloseOtherConnections}
      onCloseConnectionsToLeft={handleCloseConnectionsToLeft}
      onCloseConnectionsToRight={handleCloseConnectionsToRight}
      onAddConnection={handleOpenNewConnection}
      rightSlot={<WindowControls />}
    />
  ) : null;

  return (
    <LiveMonitorProvider activeConnectionId={activeConnectionId || undefined}>
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
                  // Remount on connection change so the schema/table tree always
                  // regenerates for the newly-active database — mirrors the
                  // `key` on DatabaseStudio below. Without this the sidebar keeps
                  // the previous connection's tables until a `dora-schema-refresh`
                  // happens to fire (e.g. on a view switch).
                  key={activeConnectionId || "no-connection"}
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
                      <WorkspaceStartScreen
                        newConnectionShortcut={formatShortcut(
                          Array.isArray(shortcuts.newConnection.combo)
                            ? shortcuts.newConnection.combo[0]
                            : shortcuts.newConnection.combo,
                        )}
                        canDropFiles={isTauri}
                        onAddConnection={handleOpenNewConnection}
                      />
                    </div>
                  ) : activeNavId === "database-studio" ? (
                    <div className="flex flex-col flex-1 min-h-0">
                      {connectionTabBar}
                      <TabBar
                        tabs={visibleTabs}
                        activeTabId={activeTabId}
                        onTabClick={handleTabClick}
                        onTabClose={closeTab}
                        onTabPinToggle={togglePinTab}
                        onCloseOtherTabs={closeOtherTabs}
                        onCloseTabsToLeft={closeTabsToLeft}
                        onCloseTabsToRight={closeTabsToRight}
                        onTabReorder={reorderTab}
                        rightSlot={
                          showConnectionTabBar ? undefined : <WindowControls />
                        }
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
                          onOpenSettings={function () {
                            // Open the general Settings tab (no deep-link to a
                            // specific control) and highlight the Startup section,
                            // which holds the table-preview / auto-select toggle.
                            handleOpenSettings(undefined, { highlight: "startup" });
                          }}
                        />
                      </ErrorBoundary>
                    </div>
                  ) : activeNavId === "sql-console" ? (
                    <div className="flex flex-col flex-1 min-h-0">
                      {connectionTabBar}
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
                    </div>
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
                      <SettingsView
                        windowControls={<WindowControls />}
                        initialSection={settingsInitialSection}
                        highlightSection={settingsHighlightSection}
                      />
                    </ErrorBoundary>
                  ) : activeNavId === "orm-cockpit" ? (
                    <ErrorBoundary feature="Schema Diff">
                      <OrmCockpitPanel
                        activeConnectionId={activeConnectionId}
                        windowControls={<WindowControls />}
                        onOpenInSqlConsole={function (sql) {
                          setActiveNavId("sql-console");
                          window.setTimeout(function () {
                            window.dispatchEvent(
                              new CustomEvent("dora-open-sql-content", {
                                detail: { sql },
                              }),
                            );
                          }, 0);
                        }}
                      />
                    </ErrorBoundary>
                  ) : activeNavId === "docker" ? (
                    <ErrorBoundary feature="Docker Manager">
                      <DockerView
                        windowControls={<WindowControls />}
                        onOpenInDataViewer={async function (container) {
                          // Detect the actual engine (Postgres/MySQL/MariaDB/
                          // CockroachDB) from the image and env vars instead of
                          // assuming Postgres — otherwise MySQL/MariaDB
                          // containers get added as Postgres and fail to connect.
                          const details = getContainerConnectionDetails(container);

                          const connectionData = {
                            name: container.name,
                            type: details.type,
                            host: details.host,
                            port: details.port,
                            user: details.user,
                            password: details.password,
                            database: details.database,
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
                onOpenChange={handleConnectionDialogOpenChange}
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

function WorkspaceStartScreen({
  newConnectionShortcut,
  canDropFiles,
  onAddConnection,
}: {
  newConnectionShortcut: string;
  canDropFiles: boolean;
  onAddConnection: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 select-none">
      <span className="text-sm font-medium lowercase tracking-[0.2em] text-muted-foreground/70">
        dora
      </span>
      <p className="mt-3 text-sm text-muted-foreground/60">
        {canDropFiles ? "Drop a database file, or " : "Press "}
        <kbd className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
          {newConnectionShortcut}
        </kbd>
        {" to connect"}
      </p>
      <button
        onClick={onAddConnection}
        className="mt-6 rounded-md border border-border/70 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-border hover:text-foreground"
      >
        New connection
      </button>
    </div>
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
