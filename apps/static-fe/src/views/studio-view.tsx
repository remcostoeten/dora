import { useState } from "react";
import { DatabaseSidebar } from "@/features/sidebar";

import { SqlConsole } from "@/features/sql-console";
import { DatabaseStudio } from "@/features/database-studio";
import { TooltipProvider } from "@/shared/ui/tooltip";

type ActiveView = "sql-console" | "database-studio";

type SelectedTable = {
  id: string;
  name: string;
} | null;

export function StudioView() {
  const [activeView, setActiveView] = useState<ActiveView>("database-studio");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [selectedTable, setSelectedTable] = useState<SelectedTable>(null);

  const handleNavSelect = (id: string) => {
    setActiveView(id as ActiveView);
  };

  const handleToggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleTableSelect = (tableId: string, tableName: string) => {
    setSelectedTable({ id: tableId, name: tableName });
    // Ensure we're in database-studio view when selecting a table
    if (activeView !== "database-studio") {
      setActiveView("database-studio");
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background">
        {/* Sidebar */}
        {isSidebarVisible && (
          <DatabaseSidebar
            activeNavId={activeView}
            onNavSelect={handleNavSelect}
            onTableSelect={handleTableSelect}
            selectedTableId={selectedTable?.id}
          />
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          {activeView === "sql-console" && (
            <SqlConsole
              key="sql-console"
              onToggleSidebar={handleToggleSidebar}
            />
          )}

          {activeView === "database-studio" && (
            <DatabaseStudio
              key={`database-studio-${selectedTable?.id ?? 'none'}`}
              tableId={selectedTable?.id ?? null}
              tableName={selectedTable?.name ?? null}
              onToggleSidebar={!isSidebarVisible ? handleToggleSidebar : undefined}
            />
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
