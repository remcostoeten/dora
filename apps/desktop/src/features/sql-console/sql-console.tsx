import { useState, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { UnifiedSidebar } from "./components/unified-sidebar";
import { SqlEditor } from "./components/sql-editor";
import { CodeEditor } from "../../features/drizzle-runner/components/code-editor";
import { ConsoleToolbar } from "./components/console-toolbar";
import { SqlResults } from "./components/sql-results";
import { ResizablePanels } from "@/features/drizzle-runner/components/resizable-panels";
import { CheatsheetPanel } from "../../features/drizzle-runner/components/cheatsheet-panel";
import { SqlQueryResult, ResultViewMode, SqlSnippet, TableInfo } from "./types";
import { DEFAULT_SQL } from "./data";
import { executeSqlQuery as executeQueryApi, getSnippets, saveSnippet, updateSnippet, deleteSnippet } from "./api";
import { DEFAULT_QUERY, executeQuery as executeDrizzleQuery } from "../../features/drizzle-runner/data";
import { getSchema } from "@/features/database-studio/api";

type Props = {
    onToggleSidebar?: () => void;
    activeConnectionId?: string;
};

export function SqlConsole({ onToggleSidebar, activeConnectionId }: Props) {
    const [mode, setMode] = useState<"sql" | "drizzle">("sql");
    const [snippets, setSnippets] = useState<SqlSnippet[]>([]);
    const [activeSnippetId, setActiveSnippetId] = useState<string | null>("playground");

    // Independent states for each mode
    const [currentSqlQuery, setCurrentSqlQuery] = useState(DEFAULT_SQL);
    const [currentDrizzleQuery, setCurrentDrizzleQuery] = useState(DEFAULT_QUERY);

    const [result, setResult] = useState<SqlQueryResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [viewMode, setViewMode] = useState<ResultViewMode>("table");
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showCheatsheet, setShowCheatsheet] = useState(false);
    const [tables, setTables] = useState<TableInfo[]>([]);

    useEffect(function () {
        if (activeConnectionId) {
            getSnippets(activeConnectionId).then(setSnippets).catch(console.error);
        }
    }, [activeConnectionId]);

    useEffect(function () {
        if (!activeConnectionId) {
            setTables([]);
            return;
        }
        getSchema(activeConnectionId).then(function (schema) {
            if (schema && schema.tables) {
                const mapped: TableInfo[] = schema.tables.map(function (t) {
                    return {
                        name: t.name,
                        type: "table" as const,
                        rowCount: 0,
                        columns: t.columns.map(function (c) {
                            return {
                                name: c.name,
                                type: c.data_type,
                                nullable: c.is_nullable,
                                primaryKey: c.is_primary_key
                            };
                        })
                    };
                });
                setTables(mapped);
            }
        }).catch(console.error);
    }, [activeConnectionId]);

    const handleExecute = useCallback(async (codeOverride?: string) => {
        if (isExecuting) return;

        setIsExecuting(true);
        setResult(null);

        try {
            if (mode === "sql") {
                const queryToRun = codeOverride || currentSqlQuery;
                if (!activeConnectionId) {
                    throw new Error("No connection selected");
                }
                const queryResult = await executeQueryApi(activeConnectionId, queryToRun);
                setResult(queryResult);
            } else {
                const queryToRun = codeOverride || currentDrizzleQuery;
                const queryResult = await executeDrizzleQuery(queryToRun);
                setResult({
                    ...queryResult,
                    queryType: "SELECT"
                });
            }
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
    }, [mode, currentSqlQuery, currentDrizzleQuery, isExecuting, activeConnectionId]);

    const handlePrettify = () => {
        if (mode === "sql") {
            const lines = currentSqlQuery.split("\n");
            const prettified = lines
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .join("\n");
            setCurrentSqlQuery(prettified);
        } else {
            const lines = currentDrizzleQuery.split("\n");
            const prettified = lines
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .join("\n");
            setCurrentDrizzleQuery(prettified);
        }
    };

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

    // Unified snippet handling - works for both SQL and Drizzle
    const handleSnippetSelect = useCallback((id: string) => {
        const snippet = snippets.find((s) => s.id === id);
        if (snippet) {
            setActiveSnippetId(id);
            // Load content into the current mode's editor
            if (mode === "sql") {
                setCurrentSqlQuery(snippet.content);
            } else {
                setCurrentDrizzleQuery(snippet.content);
            }
        }
    }, [snippets, mode]);

    const handleNewSnippet = useCallback(async (parentId?: string | null) => {
        if (!activeConnectionId) return;

        const currentContent = mode === "sql" ? currentSqlQuery : currentDrizzleQuery;
        const name = `Snippet ${snippets.length + 1}`;

        try {
            await saveSnippet(name, currentContent || (mode === "sql" ? "-- New SQL query" : "// New Drizzle query"), activeConnectionId, null);
            const loaded = await getSnippets(activeConnectionId);
            setSnippets(loaded);
        } catch (error) {
            console.error("Failed to save snippet:", error);
        }
    }, [activeConnectionId, snippets.length, mode, currentSqlQuery, currentDrizzleQuery]);

    const handleNewFolder = useCallback((parentId?: string | null) => {
        const newFolder: SqlSnippet = {
            id: `folder-${Date.now()}`,
            name: `New Folder`,
            content: "",
            createdAt: new Date(),
            updatedAt: new Date(),
            isFolder: true,
            parentId: parentId || null
        };
        setSnippets([newFolder, ...snippets]);
    }, [snippets]);

    const handleRenameSnippet = useCallback(async (id: string, newName: string) => {
        if (!activeConnectionId) return;

        const snippet = snippets.find(s => s.id === id);
        if (snippet && !snippet.isFolder) {
            try {
                await updateSnippet(parseInt(id), newName, snippet.content, activeConnectionId, null);
                const loaded = await getSnippets(activeConnectionId);
                setSnippets(loaded);
            } catch (error) {
                console.error("Failed to rename snippet:", error);
            }
        }
    }, [activeConnectionId, snippets]);

    const handleDeleteSnippet = useCallback(async (id: string) => {
        if (!activeConnectionId) return;

        try {
            await deleteSnippet(parseInt(id));
            const loaded = await getSnippets(activeConnectionId);
            setSnippets(loaded);
        } catch (error) {
            console.error("Failed to delete snippet:", error);
        }
    }, [activeConnectionId]);

    const handleTableSelect = (tableName: string) => {
        if (mode === "sql") {
            setCurrentSqlQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
        } else {
            setCurrentDrizzleQuery(`db.select().from(${tableName}).limit(100);`);
        }
    };

    const handleInsertSnippet = useCallback((code: string) => {
        if (mode === "sql") {
            setCurrentSqlQuery(prev => prev + "\n" + code);
        } else {
            setCurrentDrizzleQuery(prev => prev + "\n" + code);
        }
    }, [mode]);

    // Keyboard shortcuts for mode switching
    useEffect(() => {
        const shouldIgnoreShortcut = (target: HTMLElement, e: KeyboardEvent): boolean => {
            if (e.ctrlKey || e.metaKey || e.altKey) return true;

            // Check for editable elements
            const tagName = target.tagName;
            if (
                tagName === "INPUT" ||
                tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return true;
            }

            // Check if target is inside a Monaco editor
            const isMonacoEditor = target.closest(".monaco-editor");
            if (isMonacoEditor) return true;

            // Check if target is inside any element with data-no-shortcuts attribute
            const isInNoShortcutsZone = target.closest("[data-no-shortcuts]");
            if (isInNoShortcutsZone) return true;

            return false;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (shouldIgnoreShortcut(target, e)) return;

            if (e.key.toLowerCase() === "s") {
                setMode("sql");
            } else if (e.key.toLowerCase() === "d") {
                setMode("drizzle");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className="flex h-full w-full bg-background overflow-hidden">
            <PanelGroup direction="horizontal" className="flex-1">
                {/* Left sidebar - Query snippets (unified for both modes) */}
                {showLeftSidebar && (
                    <>
                        <Panel
                            defaultSize={18}
                            minSize={12}
                            maxSize={30}
                            collapsible
                            onCollapse={() => setShowLeftSidebar(false)}
                        >
                            <UnifiedSidebar
                                tables={tables}
                                snippets={snippets}
                                activeSnippetId={activeSnippetId}
                                onTableSelect={handleTableSelect}
                                onInsertQuery={(query) => {
                                    if (mode === "sql") {
                                        setCurrentSqlQuery(query);
                                    } else {
                                        setCurrentDrizzleQuery(query);
                                    }
                                }}
                                onSnippetSelect={handleSnippetSelect}
                                onNewSnippet={handleNewSnippet}
                                onNewFolder={handleNewFolder}
                                onRenameSnippet={handleRenameSnippet}
                                onDeleteSnippet={handleDeleteSnippet}
                            />
                        </Panel>
                        <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize" />
                    </>
                )}

                {/* Main content */}
                <Panel defaultSize={64} minSize={40}>
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Toolbar */}
                        <ConsoleToolbar
                            mode={mode}
                            onModeChange={setMode}
                            onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
                            onToggleCheatsheet={() => setShowCheatsheet(!showCheatsheet)}
                            showLeftSidebar={showLeftSidebar}
                            showCheatsheet={showCheatsheet}
                            isExecuting={isExecuting}
                            onRun={() => handleExecute()}
                            onPrettify={handlePrettify}
                            onExport={handleExport}
                            hasResults={!!result}
                        />

                        {/* Editor and Results */}
                        <div className="flex-1 overflow-hidden">
                            <ResizablePanels
                                defaultSplit={55}
                                minSize={100}
                                topPanel={
                                    <div className="relative w-full h-full">
                                        {mode === "sql" ? (
                                            <SqlEditor
                                                value={currentSqlQuery}
                                                onChange={setCurrentSqlQuery}
                                                onExecute={() => handleExecute()}
                                                isExecuting={isExecuting}
                                            />
                                        ) : (
                                            <CodeEditor
                                                value={currentDrizzleQuery}
                                                onChange={setCurrentDrizzleQuery}
                                                onExecute={function () { handleExecute(); }}
                                                isExecuting={isExecuting}
                                                tables={tables.map(function (t) {
                                                    return {
                                                        name: t.name,
                                                        columns: (t.columns || []).map(function (c) {
                                                            return {
                                                                name: c.name,
                                                                type: c.type,
                                                                nullable: c.nullable ?? false,
                                                                primaryKey: c.primaryKey ?? false
                                                            };
                                                        })
                                                    };
                                                })}
                                            />
                                        )}

                                    </div>
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
                </Panel>



                {/* Cheatsheet Panel */}
                {showCheatsheet && (
                    <>
                        <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize" />
                        <Panel
                            defaultSize={20}
                            minSize={15}
                            maxSize={35}
                            collapsible
                            onCollapse={() => setShowCheatsheet(false)}
                        >
                            <CheatsheetPanel
                                isOpen={showCheatsheet}
                                onToggle={() => setShowCheatsheet(!showCheatsheet)}
                                onInsertSnippet={handleInsertSnippet}
                            />
                        </Panel>
                    </>
                )}
            </PanelGroup>
        </div>
    );
}
