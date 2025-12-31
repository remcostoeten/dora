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
import { loadConnections, addConnection as addConnectionApi } from "@/features/connections/api";

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

  const handleConnectionSelect = async (connectionId: string) => {
    setActiveConnectionId(connectionId);
    await loadConnectionsFromBackend();
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
            onAddConnection={() => setIsConnectionDialogOpen(true)}
            onManageConnections={() => loadConnectionsFromBackend()}
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
          onOpenChange={setIsConnectionDialogOpen}
          onSave={handleAddConnection}
        />
      </div>
    </TooltipProvider>
  );
}
