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

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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

  const [activeConnectionId, setActiveConnectionId] = useState<string>(() => {
    return urlConnection || "";
  });

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadConnectionsFromBackend();
  }, []);

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
      const conns = await loadConnections();
      setConnections(conns);
      if (!activeConnectionId && conns.length > 0) {
        setActiveConnectionId(conns[0].id);
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

  const handleAddConnection = async (newConnectionData: Omit<Connection, "id" | "createdAt">) => {
    try {
      const newConnection = await addConnectionApi(newConnectionData as Connection);
      setConnections(prev => [...prev, newConnection]);
      setActiveConnectionId(newConnection.id);
      toast({
        title: "Connection Added",
        description: `Successfully connected to ${newConnection.name}`,
      });
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
      const updatedConnection = await updateConnectionApi({
        ...connectionData,
        id: editingConnection.id,
        createdAt: editingConnection.createdAt,
      } as Connection);
      setConnections(prev => prev.map(c => c.id === updatedConnection.id ? updatedConnection : c));
      toast({
        title: "Connection Updated",
        description: `Successfully updated ${updatedConnection.name}`,
      });
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
      setConnectionToDelete(connection);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteConnection = async () => {
    if (!connectionToDelete) return;

    try {
      await removeConnectionApi(connectionToDelete.id);
      setConnections(prev => prev.filter(c => c.id !== connectionToDelete.id));
      if (activeConnectionId === connectionToDelete.id) {
        const remaining = connections.filter(c => c.id !== connectionToDelete.id);
        setActiveConnectionId(remaining.length > 0 ? remaining[0].id : "");
      }
      toast({
        title: "Connection Deleted",
        description: `Successfully deleted ${connectionToDelete.name}`,
      });
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
