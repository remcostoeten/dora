import { useState, useCallback } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { QuerySidebar } from "./components/query-sidebar";
import { SchemaBrowser } from "./components/schema-browser";
import { SqlEditor } from "./components/sql-editor";
import { ConsoleToolbar } from "./components/console-toolbar";
import { SqlResults } from "./components/sql-results";
import { ResizablePanels } from "@/features/drizzle-runner/components/resizable-panels";
import { SqlQueryResult, ResultViewMode, SqlSnippet } from "./types";
import { MOCK_SNIPPETS, MOCK_TABLES, DEFAULT_SQL, executeSqlQuery, prettifySql } from "./data";

type Props = {
    onToggleSidebar?: () => void;
};

export function SqlConsole({ onToggleSidebar }: Props) {
    const [snippets, setSnippets] = useState<SqlSnippet[]>(MOCK_SNIPPETS);
    const [activeSnippetId, setActiveSnippetId] = useState<string | null>("playground");
    const [currentQuery, setCurrentQuery] = useState(DEFAULT_SQL);
    const [result, setResult] = useState<SqlQueryResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [viewMode, setViewMode] = useState<ResultViewMode>("table");
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(true);

    const handleExecute = useCallback(async (sql?: string) => {
        if (isExecuting) return;

        const queryToRun = sql || currentQuery;
        setIsExecuting(true);
        setResult(null);

        try {
            const queryResult = await executeSqlQuery(queryToRun);
            setResult(queryResult);
        } catch (error) {
            setResult({
                columns: [],
                rows: [],
                rowCount: 0,
                executionTime: 0,
                error: error instanceof Error ? error.message : "An error occurred",
                queryType: "OTHER",
            });
        } finally {
            setIsExecuting(false);
        }
    }, [currentQuery, isExecuting]);

    const handlePrettify = useCallback(() => {
        setCurrentQuery(prettifySql(currentQuery));
    }, [currentQuery]);

    const handleExport = useCallback(() => {
        if (!result || result.rows.length === 0) return;

        const jsonString = JSON.stringify(result.rows, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "query-results.json";
        a.click();
        URL.revokeObjectURL(url);
    }, [result]);

    const handleSnippetSelect = useCallback((id: string) => {
        const snippet = snippets.find((s) => s.id === id);
        if (snippet) {
            setActiveSnippetId(id);
            setCurrentQuery(snippet.content);
        }
    }, [snippets]);

    const handleNewSnippet = useCallback(() => {
        const newSnippet: SqlSnippet = {
            id: `scratch-${Date.now()}`,
            name: `SQL scratch #${snippets.length + 1}`,
            content: "-- New query\nSELECT * FROM ",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setSnippets([...snippets, newSnippet]);
        setActiveSnippetId(newSnippet.id);
        setCurrentQuery(newSnippet.content);
    }, [snippets]);

    const handleTableSelect = useCallback((tableName: string) => {
        // Insert table name at cursor or append
        setCurrentQuery((prev) => {
            if (prev.endsWith("FROM ") || prev.endsWith("JOIN ") || prev.endsWith("INTO ")) {
                return prev + tableName;
            }
            return prev + `\n-- Table: ${tableName}`;
        });
    }, []);

    return (
        <div className="flex h-full bg-background">
            {/* Main sidebar toggle */}
            {onToggleSidebar && !showLeftSidebar && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 left-2 z-10 h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onToggleSidebar}
                    title="Toggle main sidebar"
                >
                    <PanelLeft className="h-4 w-4" />
                </Button>
            )}

            {/* Left sidebar - Query manager */}
            {showLeftSidebar && (
                <QuerySidebar
                    snippets={snippets}
                    activeSnippetId={activeSnippetId}
                    onSnippetSelect={handleSnippetSelect}
                    onNewSnippet={handleNewSnippet}
                />
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <ConsoleToolbar
                    onRun={() => handleExecute()}
                    onPrettify={handlePrettify}
                    onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
                    onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
                    showLeftSidebar={showLeftSidebar}
                    showRightSidebar={showRightSidebar}
                    isExecuting={isExecuting}
                />

                {/* Editor and Results */}
                <div className="flex-1 overflow-hidden">
                    <ResizablePanels
                        defaultSplit={55}
                        minSize={100}
                        topPanel={
                            <SqlEditor
                                value={currentQuery}
                                onChange={setCurrentQuery}
                                onExecute={handleExecute}
                                isExecuting={isExecuting}
                            />
                        }
                        bottomPanel={
                            <SqlResults
                                result={result}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                onExport={handleExport}
                            />
                        }
                    />
                </div>
            </div>

            {/* Right sidebar - Schema browser */}
            {showRightSidebar && (
                <SchemaBrowser
                    tables={MOCK_TABLES}
                    onTableSelect={handleTableSelect}
                />
            )}
        </div>
    );
}
