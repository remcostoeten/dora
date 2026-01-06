import { useState, useCallback } from "react";
import { PanelLeft, Code } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CodeEditor } from "./components/code-editor";
import { EditorActions } from "./components/editor-actions";
import { ResultsPanel } from "./components/results-panel";
import { SchemaViewer } from "./components/schema-viewer";
import { CheatsheetPanel } from "./components/cheatsheet-panel";
import { QueryResult } from "./types";
import { DEFAULT_QUERY, MOCK_SCHEMA_TABLES, executeQuery } from "./data";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/shared/utils/cn";

type Props = {
    onToggleSidebar?: () => void;
};

export function DrizzleRunner({ onToggleSidebar }: Props) {
    const [queryCode, setQueryCode] = useState(DEFAULT_QUERY);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showCheatsheet, setShowCheatsheet] = useState(false);

    const handleExecute = useCallback(async (codeToRun?: string) => {
        if (isExecuting) return;

        setIsExecuting(true);
        setResult(null);

        try {
            const queryResult = await executeQuery(codeToRun || queryCode);
            setResult(queryResult);
        } catch (error) {
            setResult({
                columns: [],
                rows: [],
                rowCount: 0,
                executionTime: 0,
                error: error instanceof Error ? error.message : "An error occurred",
            });
        } finally {
            setIsExecuting(false);
        }
    }, [queryCode, isExecuting]);

    const handlePrettify = useCallback(() => {
        const lines = queryCode.split("\n");
        const prettified = lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n");
        setQueryCode(prettified);
    }, [queryCode]);

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

    const handleInsertSnippet = useCallback((code: string) => {
        setQueryCode(prev => prev + "\n" + code);
    }, []);

    return (
        <div className="flex h-full w-full flex-col bg-background overflow-hidden text-sm">
            {/* Main Toolbar / Header */}
            <div className="flex items-center h-10 border-b border-sidebar-border bg-sidebar shrink-0 px-2 justify-between">
                <div className="flex items-center gap-2">
                    {onToggleSidebar && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={onToggleSidebar}
                            title="Toggle Application Sidebar"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <span className="font-semibold text-sidebar-foreground px-2">Drizzle Runner</span>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 text-xs", isSidebarCollapsed && "bg-sidebar-accent")}
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                    {isSidebarCollapsed ? "Show Schema" : "Hide Schema"}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 text-xs gap-1.5", showCheatsheet && "bg-sidebar-accent")}
                    onClick={() => setShowCheatsheet(!showCheatsheet)}
                >
                    <Code className="h-3.5 w-3.5" />
                    <span>{showCheatsheet ? "Hide" : "Cheatsheet"}</span>
                </Button>
            </div>

            <PanelGroup direction="horizontal" className="flex-1">
                {/* Left Sidebar: Schema */}
                <Panel
                    defaultSize={20}
                    minSize={15}
                    maxSize={40}
                    collapsible={true}
                    collapsedSize={0}
                    onCollapse={() => setIsSidebarCollapsed(true)}
                    onExpand={() => setIsSidebarCollapsed(false)}
                    className={cn("bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out", isSidebarCollapsed && "hidden")}
                >
                    <div className="h-full flex flex-col">
                        <div className="p-3 border-b border-sidebar-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Schema
                        </div>
                        <SchemaViewer tables={MOCK_SCHEMA_TABLES} />
                    </div>
                </Panel>

                {!isSidebarCollapsed && <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors" />}

                {/* Main Content Area */}
                <Panel defaultSize={80} minSize={30}>
                    <PanelGroup direction="vertical">
                        {/* Top: Editor */}
                        <Panel defaultSize={60} minSize={20}>
                            <div className="flex flex-col h-full relative">
                                <CodeEditor
                                    value={queryCode}
                                    onChange={setQueryCode}
                                    onExecute={handleExecute}
                                    isExecuting={isExecuting}
                                />
                                {/* Overlay Editor Actions on bottom-right of editor or top-right? 
                                    Let's keep existing EditorActions usage but position it better.
                                    Let's put it as floating or toolbar.
                                */}
                                <div className="absolute top-2 right-4 z-10 w-auto">
                                    <EditorActions
                                        showJson={showJson}
                                        onShowJsonToggle={() => setShowJson(!showJson)}
                                        onPrettify={handlePrettify}
                                        onExport={handleExport}
                                        isExecuting={isExecuting}
                                        hasResults={!!result && result.rows.length > 0}
                                    />
                                </div>
                            </div>
                        </Panel>

                        <PanelResizeHandle className="h-1 bg-sidebar-border hover:bg-primary/20 transition-colors" />

                        {/* Bottom: Results */}
                        <Panel defaultSize={40} minSize={10}>
                            <ResultsPanel result={result} showJson={showJson} />
                        </Panel>
                    </PanelGroup>
                </Panel>

                <PanelResizeHandle className={cn("w-1 bg-transparent hover:bg-primary/20 transition-colors", !showCheatsheet && "hidden")} />

                <Panel
                    defaultSize={20}
                    minSize={15}
                    maxSize={40}
                    collapsible={true}
                    collapsedSize={0}
                >
                    <CheatsheetPanel
                        isOpen={showCheatsheet}
                        onToggle={() => setShowCheatsheet(!showCheatsheet)}
                        onInsertSnippet={handleInsertSnippet}
                    />
                </Panel>
            </PanelGroup>
        </div>
    );
}
