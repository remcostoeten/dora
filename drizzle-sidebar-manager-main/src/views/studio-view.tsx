import { useState } from "react";
import { DatabaseSidebar } from "@/features/sidebar";
import { DrizzleRunner } from "@/features/drizzle-runner";
import { SqlConsole } from "@/features/sql-console";
import { TooltipProvider } from "@/shared/ui/tooltip";

type ActiveView = "sql-console" | "drizzle-runner" | "database-studio";

export function StudioView() {
  const [activeView, setActiveView] = useState<ActiveView>("database-studio");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const handleNavSelect = (id: string) => {
    setActiveView(id as ActiveView);
  };

  const handleToggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background">
        {/* Sidebar */}
        {isSidebarVisible && (
          <DatabaseSidebar
            activeNavId={activeView}
            onNavSelect={handleNavSelect}
          />
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          {activeView === "sql-console" && (
            <SqlConsole onToggleSidebar={handleToggleSidebar} />
          )}

          {activeView === "drizzle-runner" && (
            <DrizzleRunner onToggleSidebar={handleToggleSidebar} />
          )}

          {activeView === "database-studio" && (
            <div className="flex flex-col h-full">
              {/* Header for consistency when sidebar is hidden */}
              {!isSidebarVisible && (
                <div className="flex items-center h-11 border-b border-sidebar-border bg-sidebar shrink-0 px-3">
                  <button
                    className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
                    onClick={handleToggleSidebar}
                    title="Toggle sidebar"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </button>
                  <span className="ml-3 text-sm text-sidebar-foreground">Database Studio</span>
                </div>
              )}

              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-semibold text-foreground mb-2">
                    Database Studio
                  </h1>
                  <p className="text-muted-foreground">
                    Select a table from the sidebar to browse data
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
