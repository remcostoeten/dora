import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Toaster } from "@/shared/ui/toaster";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { useToast } from "@/shared/ui/use-toast";
import { useAdapter } from "@/core/data-provider";
import { getAdapterError } from "@/core/data-provider/types";
import { useSettings } from "@/core/settings";
import { useEffectiveShortcuts, useShortcut } from "@/core/shortcuts";
import { LiveMonitorProvider } from "@/core/live-monitor";
import { NavigationSidebar, SidebarProvider } from "@/features/app-sidebar";
import { CommandPalette } from "@/features/command-palette";
import { useConnections, useConnectionMutations } from "@/core/data-provider/hooks";
import {
  backendToFrontendConnection,
  frontendToBackendDatabaseInfo,
} from "@/features/connections/utils/mapping";
import { ConnectionDialog } from "@/features/connections/components/connection-dialog";
import { Connection } from "@/features/connections/types";
const DatabaseStudio = lazy(function () {
  return import("@/features/database-studio/database-studio").then(function (m) {
    return { default: m.DatabaseStudio };
  });
});
const DockerView = lazy(function () {
  return import("@/features/docker-manager").then(function (m) {
    return { default: m.DockerView };
  });
});
const SqlConsole = lazy(function () {
  return import("@/features/sql-console/sql-console").then(function (m) {
    return { default: m.SqlConsole };
  });
});
const SchemaVisualizer = lazy(function () {
  return import("@/features/schema-visualizer").then(function (m) {
    return { default: m.SchemaVisualizer };
  });
});
import { DatabaseSidebar } from "@/features/sidebar/database-sidebar";
import { WindowControls } from "@/components/window-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { mapConnectionError } from "@/shared/utils/error-messages";
import { EmptyState } from "@/shared/ui/empty-state";
import { ViewLoadingShell } from "@/shared/ui/view-loading-shell";
import { getTableRefParts } from "@/shared/utils/table-ref";
import { Plug } from "lucide-react";

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {
    settings,
    updateSetting,
    updateSettings,
    isLoading: isSettingsLoading,
  } = useSettings();

  const { data: connections = [], isLoading: isConnectionsLoading } = useConnections();
  const isLoading = isSettingsLoading || isConnectionsLoading;
  const { addConnection, updateConnection, removeConnection } = useConnectionMutations();

  const urlView = searchParams.get("view");
  const urlTable = searchParams.get("table");
  const urlConnection = searchParams.get("connection");

  const [activeNavId, setActiveNavId] = useState<string>(() => {
    return urlView || "database-studio";
  });

  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    return urlTable || "";
  });

  const [selectedTableName, setSelectedTableName] = useState("");
  const autoSelectFirstTableRef = useRef(false);
  const connectionInitializedRef = useRef(false);

  const [activeConnectionId, setActiveConnectionId] = useState<string>("");

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<
    Connection | undefined
  >(undefined);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] =
    useState<Connection | null>(null);
  const startupConnectionMode =
    settings.startupConnectionMode ??
    (settings.restoreLastConnection ? "auto" : "empty");

  const { toast } = useToast();
  const shortcuts = useEffectiveShortcuts();
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

  $.bind(shortcuts.newConnection.combo).on(function () {
    setIsConnectionDialogOpen(true);
  }, { description: shortcuts.newConnection.description });

  $.bind(shortcuts.toggleSidebar.combo).on(function () {
    setIsSidebarOpen(function (open) { return !open; });
  }, { description: shortcuts.toggleSidebar.description });

  $.bind(shortcuts.reconnect.combo).on(function () {
    if (activeConnectionId) handleConnectionSelect(activeConnectionId);
  }, { description: shortcuts.reconnect.description });

  // Go-to chord sequences — except 'typing' so Monaco doesn't intercept
  $.bind(shortcuts.gotoDashboard.combo).except('typing').on(function () {
    setActiveNavId('database-studio');
  }, { description: shortcuts.gotoDashboard.description });

  $.bind(shortcuts.gotoSettings.combo).except('typing').on(function () {
    setActiveNavId('settings');
  }, { description: shortcuts.gotoSettings.description });

  $.bind(shortcuts.gotoConnections.combo).except('typing').on(function () {
    setActiveNavId('connections');
  }, { description: shortcuts.gotoConnections.description });

  $.bind(shortcuts.gotoEditor.combo).except('typing').on(function () {
    setActiveNavId('sql-console');
  }, { description: shortcuts.gotoEditor.description });

  $.bind(shortcuts.gotoDocker.combo).except('typing').on(function () {
    setActiveNavId('docker');
  }, { description: shortcuts.gotoDocker.description });

  // Connection switching by index (1-9)
  connections.slice(0, 9).forEach(function (conn, i) {
    const key = `switchConnection${i + 1}` as keyof typeof shortcuts;
    const def = shortcuts[key];
    if (def) {
      $.bind(def.combo).on(function () {
        handleConnectionSelect(conn.id);
      }, { description: def.description });
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
      const connectionChanged =
        activeConnectionId && currentConnection !== activeConnectionId;

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

  useEffect(function () {
    setSelectedTableName(getTableRefParts(selectedTableId).tableName);
  }, [selectedTableId]);

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
            setSelectedTableId(settings.lastTableId);
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
        (import.meta.env.MODE === "demo" ||
          window.location.hostname.includes("demo") ||
          import.meta.env.VITE_IS_WEB === "true");

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

  async function handleAddConnection(connection: Omit<Connection, "id" | "status">) {
    try {
      const dbInfo = frontendToBackendDatabaseInfo(connection as Connection);
      await addConnection.mutateAsync({
        name: connection.name,
        databaseType: dbInfo,
        sshConfig: null, // TODO: handle SSH
      });
      setIsConnectionDialogOpen(false);
      toast({ title: "Connection Added", description: `"${connection.name}" has been created.` });
    } catch (error) {
      toast({
        title: "Failed to Add Connection",
        description: mapConnectionError(error instanceof Error ? error : new Error("Unknown error")),
        variant: "destructive",
      });
    }
  }

  async function handleUpdateConnection(connection: Omit<Connection, "id" | "status">) {
    if (!editingConnection) return;
    try {
      const dbInfo = frontendToBackendDatabaseInfo(connection as Connection);
      await updateConnection.mutateAsync({
        id: editingConnection.id,
        name: connection.name,
        databaseType: dbInfo,
        sshConfig: null, // TODO: handle SSH
      });
      setIsConnectionDialogOpen(false);
      setEditingConnection(undefined);
      toast({ title: "Connection Updated", description: `"${connection.name}" has been updated.` });
    } catch (error) {
      toast({
        title: "Failed to Update Connection",
        description: mapConnectionError(error instanceof Error ? error : new Error("Unknown error")),
        variant: "destructive",
      });
    }
  }

  function handleDeleteConnection(connectionId: string) {
    const connection = connections.find(function (c) {
      return c.id === connectionId;
    });
    if (connection) {
      setConnectionToDelete(connection);
      setDeleteDialogOpen(true);
    }
  }

  async function confirmDeleteConnection() {
    if (!connectionToDelete) return;
    try {
      await removeConnection.mutateAsync(connectionToDelete.id);
      if (activeConnectionId === connectionToDelete.id) {
        setActiveConnectionId("");
        setSelectedTableId("");
      }
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
      toast({ title: "Connection Deleted", description: `"${connectionToDelete.name}" has been removed.` });
    } catch (error) {
      toast({
        title: "Failed to Delete Connection",
        description: mapConnectionError(error instanceof Error ? error : new Error("Unknown error")),
        variant: "destructive",
      });
    }
  }

  async function handleConnectionSelect(connectionId: string) {
    setActiveConnectionId(connectionId);
    setSelectedTableId("");
    setSelectedTableName("");
    autoSelectFirstTableRef.current = false;
  }

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

  async function handleDialogSave(
    connectionData: Omit<Connection, "id" | "createdAt">,
  ) {
    if (editingConnection) {
      await handleUpdateConnection(connectionData);
    } else {
      await handleAddConnection(connectionData);
    }
  }

  const handleTableSelect = useCallback(function (id: string, name: string) {
    setSelectedTableId(id);
    setSelectedTableName(name);
  }, []);

  const handleAutoSelectComplete = useCallback(function () {
    autoSelectFirstTableRef.current = false;
  }, []);

  // Show database panel for sql-console and database-studio views
  const showDatabasePanel =
    activeNavId === "sql-console" ||
    activeNavId === "database-studio" ||
    activeNavId === "schema-visualizer";
  const paletteActiveNavId =
    activeNavId === "docker" || activeNavId === "sql-console"
      ? activeNavId
      : "database-studio";

  return (
    <LiveMonitorProvider activeConnectionId={activeConnectionId || undefined}>
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
          <div
            className="flex items-center justify-end h-8 w-full shrink-0 bg-sidebar border-b border-border"
            data-tauri-drag-region="true"
          >
            <WindowControls className="pr-2" />
          </div>
          <div className="flex flex-1 overflow-hidden">
            <NavigationSidebar
              activeNavId={activeNavId}
              onNavSelect={setActiveNavId}
            />

            {showDatabasePanel && isSidebarOpen && (
              <DatabaseSidebar
                activeNavId={activeNavId}
                onNavSelect={setActiveNavId}
                onTableSelect={handleTableSelect}
                selectedTableId={selectedTableId}
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
              (activeNavId === "database-studio" ||
                activeNavId === "sql-console") ? (
                <EmptyState
                  icon={<Plug className="h-16 w-16" />}
                  title="No Connections"
                  description="Add a database connection to start exploring your data."
                  action={{
                    label: "Add Connection",
                    onClick: handleOpenNewConnection,
                  }}
                />
              ) : activeNavId === "database-studio" ? (
                <ErrorBoundary feature="Database Studio">
                  <DatabaseStudio
                    tableId={selectedTableId}
                    tableName={selectedTableName}
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={function () { return setIsSidebarOpen(!isSidebarOpen); }}
                    initialRowPK={settings.lastRowPK}
                    onRowSelectionChange={function (pk) {
                      if (pk !== settings.lastRowPK) {
                        updateSetting("lastRowPK", pk);
                      }
                    }}
                    activeConnectionId={activeConnectionId}
                    onAddConnection={handleOpenNewConnection}
                  />
                </ErrorBoundary>
              ) : activeNavId === "sql-console" ? (
                <ErrorBoundary feature="SQL Console">
                  <SqlConsole
                    onToggleSidebar={function () { return setIsSidebarOpen(!isSidebarOpen); }}
                    activeConnectionId={activeConnectionId}
                    getConnectionName={function (id) {
                      return connections.find(function (c) { return c.id === id; })?.name ?? id.slice(0, 8);
                    }}
                  />
                </ErrorBoundary>
              ) : activeNavId === "schema-visualizer" ? (
                <ErrorBoundary feature="Schema Visualizer">
                  <SchemaVisualizer
                    activeConnectionId={activeConnectionId}
                    onOpenTable={function (tableId, tableName) {
                      handleTableSelect(tableId, tableName);
                      setActiveNavId("database-studio");
                    }}
                  />
                </ErrorBoundary>
              ) : activeNavId === "docker" ? (
                <ErrorBoundary feature="Docker Manager">
                  <DockerView
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
                      const password = passEnv
                        ? passEnv.split("=")[1]
                        : "postgres";
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
                    onToggleSidebar={function () { return setIsSidebarOpen(!isSidebarOpen); }}
                    activeConnectionId={activeConnectionId}
                    getConnectionName={function (id) {
                      return connections.find(function (c) { return c.id === id; })?.name ?? id.slice(0, 8);
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
                if (!open) setEditingConnection(undefined);
              }}
              onSave={handleDialogSave}
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

            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{connectionToDelete?.name}
                    "? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={function () { return setConnectionToDelete(null); }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteConnection}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
    </LiveMonitorProvider>
  );
}
