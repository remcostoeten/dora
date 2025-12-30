import { useState, useCallback } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { RunnerTabs } from "./components/runner-tabs";
import { CodeEditor } from "./components/code-editor";
import { EditorActions } from "./components/editor-actions";
import { ResultsPanel } from "./components/results-panel";
import { ResizablePanels } from "./components/resizable-panels";
import { SchemaViewer } from "./components/schema-viewer";
import { RunnerTab, QueryResult } from "./types";
import { DEFAULT_QUERY, MOCK_SCHEMA_TABLES, executeQuery } from "./data";

type Props = {
    onToggleSidebar?: () => void;
};

export function DrizzleRunner({ onToggleSidebar }: Props) {
    const [activeTab, setActiveTab] = useState<RunnerTab>("queries");
    const [queryCode, setQueryCode] = useState(DEFAULT_QUERY);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [showJson, setShowJson] = useState(false);

    const handleExecute = useCallback(async () => {
        if (isExecuting) return;

        setIsExecuting(true);
        setResult(null);

        try {
            const queryResult = await executeQuery(queryCode);
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
        // Simple prettify - add proper indentation
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

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center h-11 border-b border-sidebar-border bg-sidebar shrink-0">
                {onToggleSidebar && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 ml-2 text-muted-foreground hover:text-sidebar-foreground"
                        onClick={onToggleSidebar}
                        title="Toggle sidebar"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </Button>
                )}

                <RunnerTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === "queries" ? (
                    <ResizablePanels
                        defaultSplit={55}
                        minSize={120}
                        topPanel={
                            <div className="relative h-full">
                                <CodeEditor
                                    value={queryCode}
                                    onChange={setQueryCode}
                                    onExecute={handleExecute}
                                    isExecuting={isExecuting}
                                />
                                <EditorActions
                                    showJson={showJson}
                                    onShowJsonToggle={() => setShowJson(!showJson)}
                                    onPrettify={handlePrettify}
                                    onExport={handleExport}
                                    isExecuting={isExecuting}
                                    hasResults={!!result && result.rows.length > 0}
                                />
                            </div>
                        }
                        bottomPanel={<ResultsPanel result={result} showJson={showJson} />}
                    />
                ) : (
                    <SchemaViewer tables={MOCK_SCHEMA_TABLES} />
                )}
            </div>
        </div>
    );
}
