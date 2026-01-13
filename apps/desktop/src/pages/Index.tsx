import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DatabaseSidebar } from "@/features/sidebar/database-sidebar";
import { DatabaseStudio } from "@/features/database-studio/database-studio";
import { SqlConsole } from "@/features/sql-console/sql-console";
import { Connection } from "@/features/connections/types";
import { ConnectionDialog } from "@/features/connections/components/connection-dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { loadConnections, addConnection as addConnectionApi, updateConnection as updateConnectionApi, removeConnection as removeConnectionApi } from "@/features/connections/api";
import { useAdapter } from "@/core/data-provider";
import { useSettings } from "@/core/settings";

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const adapter = useAdapter();
  const { settings, updateSetting, isLoading: isSettingsLoading } = useSettings();

  const urlView = searchParams.get("view");
  const urlTable = searchParams.get("table");
  const urlConnection = searchParams.get("connection");

  const [activeNavId, setActiveNavId] = useState<string>(() => {
    return urlView || "database-studio";
  });

  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    return urlTable || "categories";
  });

  const [selectedTableName, setSelectedTableName] = useState("categories");

  const [connections, setConnections] = useState<Connection[]>([]);

  const [activeConnectionId, setActiveConnectionId] = useState<string>("");

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadConnectionsFromBackend();
  }, [adapter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    if (activeNavId) params.set("view", activeNavId);
    if (selectedTableId) params.set("table", selectedTableId);
    if (activeConnectionId) params.set("connection", activeConnectionId);

    setSearchParams(params, { replace: true });
  }, [activeNavId, selectedTableId, activeConnectionId, setSearchParams]);

  useEffect(() => {
    setSelectedTableName(selectedTableId);
  }, [selectedTableId]);

  const loadConnectionsFromBackend = async () => {
    try {
      setIsLoading(true);
      const result = await adapter.getConnections();
      if (result.ok) {
        setConnections(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load connections",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(function initializeConnection() {
    if (isSettingsLoading || isLoading) return;
    if (connections.length === 0) return;

    if (urlConnection) {
      setActiveConnectionId(urlConnection);
      return;
    }

    if (settings.restoreLastConnection && settings.lastConnectionId) {
      const lastConnection = connections.find(function (c) {
        return c.id === settings.lastConnectionId;
      });
      if (lastConnection) {
        setActiveConnectionId(lastConnection.id);
        return;
      }
    }
  }, [isSettingsLoading, isLoading, connections, urlConnection, settings.restoreLastConnection, settings.lastConnectionId]);

  useEffect(function saveLastConnection() {
    if (!activeConnectionId || isSettingsLoading) return;
    if (settings.lastConnectionId !== activeConnectionId) {
      updateSetting("lastConnectionId", activeConnectionId);
    }
  }, [activeConnectionId, isSettingsLoading, settings.lastConnectionId, updateSetting]);

  const handleAddConnection = async (newConnectionData: Omit<Connection, "id" | "createdAt">) => {
    try {
      // Create a temporary ID for the adapter call if needed, but the adapter should handle it
      // For now, we need to map frontend Connection format to what adapter expects
      // The adapter addConnection expects (name, databaseType, sshConfig)

      // NOTE: This part is tricky because frontend uses `Connection` object but adapter expects expanded args
      // We need to use the `frontendToBackendDatabaseInfo` helper or similar logic
      // But `frontendToBackendDatabaseInfo` is in `api.ts`.
      // Ideally, the adapter should accept a strictly typed object, but `addConnection` signature is:
      // addConnection(name: string, databaseType: DatabaseInfo, sshConfig: JsonValue | null)

      // Let's import the helper to convert type
      // Wait, `adapter.addConnection` is the lower level API. 
      // The `Connection` type in `Index.tsx` is `FrontendConnection`.

      // Let's rely on the helper which we should import. 
      // BUT `api.ts` is deprecated ideally. We should move that helper to a shared location or `types.ts`.

      // For now, let's keep importing helper from `api.ts` since it's just a pure function
      const { frontendToBackendDatabaseInfo } = await import("@/features/connections/api");

      const dbInfo = frontendToBackendDatabaseInfo(newConnectionData as Connection);
      const result = await adapter.addConnection(newConnectionData.name, dbInfo, null);

      if (result.ok) {
        // Adapter returns connection info, we might need to fetch all again or convert it back
        // Adapter `addConnection` returns `ConnectionInfo` (backend type)
        // We need `backendToFrontendConnection` to update state locally without refetch
        const { backendToFrontendConnection } = await import("@/features/connections/api");
        const newFrontendConn = backendToFrontendConnection(result.data);

        setConnections(prev => [...prev, newFrontendConn]);
        setActiveConnectionId(newFrontendConn.id);
        toast({
          title: "Connection Added",
          description: `Successfully connected to ${newFrontendConn.name}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add connection",
        variant: "destructive",
      });
    }
  };

  const handleUpdateConnection = async (connectionData: Omit<Connection, "id" | "createdAt">) => {
    if (!editingConnection) return;

    try {
      const { frontendToBackendDatabaseInfo, backendToFrontendConnection } = await import("@/features/connections/api");

      // We need to construct a full connection object to get the DatabaseInfo
      const tempConn = { ...connectionData, id: editingConnection.id, createdAt: editingConnection.createdAt } as Connection;
      const dbInfo = frontendToBackendDatabaseInfo(tempConn);

      const result = await adapter.updateConnection(editingConnection.id, connectionData.name, dbInfo, null);

      if (result.ok) {
        const updatedConnection = backendToFrontendConnection(result.data);
        setConnections(prev => prev.map(c => c.id === updatedConnection.id ? updatedConnection : c));
        toast({
          title: "Connection Updated",
          description: `Successfully updated ${updatedConnection.name}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update connection",
        variant: "destructive",
      });
    }
  };

  const handleConnectionSelect = async (connectionId: string) => {
    setActiveConnectionId(connectionId);
    await loadConnectionsFromBackend();
  };

  const handleViewConnection = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setEditingConnection(connection);
      setIsConnectionDialogOpen(true);
    }
  };

  const handleEditConnection = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setEditingConnection(connection);
      setIsConnectionDialogOpen(true);
    }
  };

  const handleDeleteConnection = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      if (settings.confirmBeforeDelete) {
        setConnectionToDelete(connection);
        setDeleteDialogOpen(true);
      } else {
        confirmDeleteConnection();
      }
    }
  };

  const confirmDeleteConnection = async () => {
    if (!connectionToDelete) return;

    try {
      const result = await adapter.removeConnection(connectionToDelete.id);

      if (result.ok) {
        setConnections(prev => prev.filter(c => c.id !== connectionToDelete.id));
        if (activeConnectionId === connectionToDelete.id) {
          const remaining = connections.filter(c => c.id !== connectionToDelete.id);
          setActiveConnectionId(remaining.length > 0 ? remaining[0].id : "");
        }
        toast({
          title: "Connection Deleted",
          description: `Successfully deleted ${connectionToDelete.name}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete connection",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  };

  const handleOpenNewConnection = () => {
    setEditingConnection(undefined);
    setIsConnectionDialogOpen(true);
  };

  const handleDialogSave = async (connectionData: Omit<Connection, "id" | "createdAt">) => {
    if (editingConnection) {
      await handleUpdateConnection(connectionData);
    } else {
      await handleAddConnection(connectionData);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {isSidebarOpen && (
          <DatabaseSidebar
            activeNavId={activeNavId}
            onNavSelect={setActiveNavId}
            onTableSelect={(id, name) => {
              setSelectedTableId(id);
              setSelectedTableName(name);
            }}
            selectedTableId={selectedTableId}
            connections={connections}
            activeConnectionId={activeConnectionId}
            onConnectionSelect={handleConnectionSelect}
            onAddConnection={handleOpenNewConnection}
            onManageConnections={() => {
              const activeConn = connections.find(c => c.id === activeConnectionId);
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

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeNavId === "database-studio" ? (
            <DatabaseStudio
              tableId={selectedTableId}
              tableName={selectedTableName}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              activeConnectionId={activeConnectionId}
              onAddConnection={handleOpenNewConnection}
            />
          ) : (
            <SqlConsole
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              activeConnectionId={activeConnectionId}
            />
          )}
        </main>

        <ConnectionDialog
          open={isConnectionDialogOpen}
          onOpenChange={(open) => {
            setIsConnectionDialogOpen(open);
            if (!open) setEditingConnection(undefined);
          }}
          onSave={handleDialogSave}
          initialValues={editingConnection}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{connectionToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConnectionToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteConnection}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
