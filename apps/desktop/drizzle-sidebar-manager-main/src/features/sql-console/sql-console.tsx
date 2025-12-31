import { useState, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { QuerySidebar } from "./components/query-sidebar";
import { SchemaBrowser } from "./components/schema-browser";
import { SqlEditor } from "./components/sql-editor";
import { CodeEditor } from "../../features/drizzle-runner/components/code-editor";
import { EditorActions } from "../../features/drizzle-runner/components/editor-actions";
import { ConsoleToolbar } from "./components/console-toolbar";
import { SqlResults } from "./components/sql-results";
import { ResizablePanels } from "@/features/drizzle-runner/components/resizable-panels";
import { CheatsheetPanel } from "../../features/drizzle-runner/components/cheatsheet-panel";
import { SqlQueryResult, ResultViewMode, SqlSnippet } from "./types";
import { MOCK_SNIPPETS, MOCK_TABLES, DEFAULT_SQL, executeSqlQuery, prettifySql } from "./data";
import { DEFAULT_QUERY, executeQuery as executeDrizzleQuery } from "../../features/drizzle-runner/data";

type Props = {
    onToggleSidebar?: () => void;
};

export function SqlConsole({ onToggleSidebar }: Props) {
    const [mode, setMode] = useState<"sql" | "drizzle">("sql");
    const [snippets, setSnippets] = useState<SqlSnippet[]>(MOCK_SNIPPETS);
    const [activeSnippetId, setActiveSnippetId] = useState<string | null>("playground");

    // Independent states for each mode
    const [currentSqlQuery, setCurrentSqlQuery] = useState(DEFAULT_SQL);
    const [currentDrizzleQuery, setCurrentDrizzleQuery] = useState(DEFAULT_QUERY);

    const [result, setResult] = useState<SqlQueryResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [viewMode, setViewMode] = useState<ResultViewMode>("table");
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [showCheatsheet, setShowCheatsheet] = useState(false);

    const handleExecute = useCallback(async (codeOverride?: string) => {
        if (isExecuting) return;

        setIsExecuting(true);
        setResult(null);

        try {
            if (mode === "sql") {
                const queryToRun = codeOverride || currentSqlQuery;
                const queryResult = await executeSqlQuery(queryToRun);
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
    }, [mode, currentSqlQuery, currentDrizzleQuery, isExecuting]);

    const handlePrettify = () => {
        if (mode === "sql") {
            setCurrentSqlQuery(prettifySql(currentSqlQuery));
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

    const handleNewSnippet = useCallback((parentId?: string | null) => {
        const currentContent = mode === "sql" ? currentSqlQuery : currentDrizzleQuery;
        const newSnippet: SqlSnippet = {
            id: Date.now().toString(),
            name: `Snippet ${snippets.length + 1}`,
            content: currentContent || (mode === "sql" ? "-- New SQL query" : "// New Drizzle query"),
            createdAt: new Date(),
            updatedAt: new Date(),
            isFolder: false,
            parentId: parentId || null
        };
        setSnippets([newSnippet, ...snippets]);
        setActiveSnippetId(newSnippet.id);
    }, [snippets, mode, currentSqlQuery, currentDrizzleQuery]);

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

    const handleRenameSnippet = useCallback((id: string, newName: string) => {
        setSnippets(prev => prev.map(s =>
            s.id === id ? { ...s, name: newName, updatedAt: new Date() } : s
        ));
    }, []);

    const handleDeleteSnippet = useCallback((id: string) => {
        setSnippets(prev => {
            // If it's a folder, we should also delete its children
            const toDelete = new Set([id]);
            const findChildren = (parentId: string) => {
                prev.forEach(s => {
                    if (s.parentId === parentId) {
                        toDelete.add(s.id);
                        if (s.isFolder) findChildren(s.id);
                    }
                });
            };

            const item = prev.find(s => s.id === id);
            if (item?.isFolder) findChildren(id);

            const filtered = prev.filter(s => !toDelete.has(s.id));

            // If the active snippet was deleted, reset to playground
            if (activeSnippetId && toDelete.has(activeSnippetId)) {
                setActiveSnippetId("playground");
            }

            return filtered;
        });
    }, [activeSnippetId]);

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
                            <QuerySidebar
                                snippets={snippets}
                                activeSnippetId={activeSnippetId}
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
                            onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
                            onToggleCheatsheet={() => setShowCheatsheet(!showCheatsheet)}
                            showLeftSidebar={showLeftSidebar}
                            showRightSidebar={showRightSidebar}
                            showCheatsheet={showCheatsheet}
                            isExecuting={isExecuting}
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
                                                onExecute={() => handleExecute()}
                                                isExecuting={isExecuting}
                                                tables={MOCK_TABLES.map(t => ({
                                                    ...t,
                                                    columns: t.columns || []
                                                })) as any}
                                            />
                                        )}

                                        <EditorActions
                                            onRun={() => handleExecute()}
                                            onPrettify={handlePrettify}
                                            isExecuting={isExecuting}
                                            hasResults={!!result}
                                            onExport={handleExport}
                                        />
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

                {/* Right sidebar - Schema browser */}
                {showRightSidebar && (
                    <>
                        <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize" />
                        <Panel
                            defaultSize={18}
                            minSize={12}
                            maxSize={30}
                            collapsible
                            onCollapse={() => setShowRightSidebar(false)}
                        >
                            <SchemaBrowser
                                tables={MOCK_TABLES}
                                onTableSelect={handleTableSelect}
                                onInsertQuery={(query) => {
                                    if (mode === "sql") {
                                        setCurrentSqlQuery(query);
                                    } else {
                                        setCurrentDrizzleQuery(query);
                                    }
                                }}
                            />
                        </Panel>
                    </>
                )}

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
