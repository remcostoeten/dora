import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DatabaseSidebar } from "@/features/sidebar/database-sidebar";
import { DatabaseStudio } from "@/features/database-studio/database-studio";
import { DrizzleRunner } from "@/features/drizzle-runner/drizzle-runner";
import { Connection } from "@/features/connections/types";
import { ConnectionDialog } from "@/features/connections/components/connection-dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const INITIAL_CONNECTIONS: Connection[] = [
  {
    id: "1",
    name: "Production DB",
    type: "postgres",
    host: "aws-prod-db-01.c8s7d6f5.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "admin",
    database: "store_prod",
    createdAt: Date.now(),
    status: "connected",
  },
  {
    id: "2",
    name: "Staging Replica",
    type: "postgres",
    host: "staging-db.internal",
    port: 5432,
    user: "read_only",
    database: "store_stage",
    createdAt: Date.now() - 100000,
    status: "error",
    error: "Connection timed out",
  },
  {
    id: "3",
    name: "Local Development",
    type: "sqlite",
    url: "file:./dev.db",
    createdAt: Date.now() - 200000,
    status: "idle",
  }
];

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // URL State Helpers
  const urlView = searchParams.get("view");
  const urlTable = searchParams.get("table");
  const urlConnection = searchParams.get("connection");

  // State Initialization (URL -> LocalStorage -> Default)
  const [activeNavId, setActiveNavId] = useState<string>(() => {
    return urlView || "database-studio";
  });

  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    return urlTable || "categories";
  });

  const [selectedTableName, setSelectedTableName] = useState("categories");

  // Connection State
  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = localStorage.getItem("dora_connections");
    return saved ? JSON.parse(saved) : INITIAL_CONNECTIONS;
  });

  const [activeConnectionId, setActiveConnectionId] = useState<string>(() => {
    if (urlConnection) return urlConnection;
    const saved = localStorage.getItem("dora_active_connection_id");
    return saved || INITIAL_CONNECTIONS[0].id;
  });

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const { toast } = useToast();

  // Sync State to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    if (activeNavId) params.set("view", activeNavId);
    if (selectedTableId) params.set("table", selectedTableId);
    if (activeConnectionId) params.set("connection", activeConnectionId);

    setSearchParams(params, { replace: true });
  }, [activeNavId, selectedTableId, activeConnectionId, setSearchParams]);

  // Sync Table Name (Mock logic for now, ideally derived from schema)
  useEffect(() => {
    // In a real app, we'd lookup the table name from the ID in the schema
    setSelectedTableName(selectedTableId);
  }, [selectedTableId]);

  // Persist connections
  useEffect(() => {
    localStorage.setItem("dora_connections", JSON.stringify(connections));
  }, [connections]);

  // Persist active connection
  useEffect(() => {
    localStorage.setItem("dora_active_connection_id", activeConnectionId);
  }, [activeConnectionId]);

  const handleAddConnection = (newConnectionData: Omit<Connection, "id" | "createdAt">) => {
    const newConnection: Connection = {
      ...newConnectionData,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
    };

    setConnections(prev => [...prev, newConnection]);
    setActiveConnectionId(newConnection.id);
    toast({
      title: "Connection Added",
      description: `Successfully connected to ${newConnection.name}`,
    });
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

            // Connection Props
            connections={connections}
            activeConnectionId={activeConnectionId}
            onConnectionSelect={setActiveConnectionId}
            onAddConnection={() => setIsConnectionDialogOpen(true)}
            onManageConnections={() => console.log("Manage connections clicked")}
          />
        )}

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeNavId === "database-studio" ? (
            <DatabaseStudio
              tableId={selectedTableId}
              tableName={selectedTableName}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
          ) : (
            <DrizzleRunner />
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
