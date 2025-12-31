import { Table2, Braces, Download, Copy } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { SqlQueryResult, ResultViewMode } from "../types";

type Props = {
    result: SqlQueryResult | null;
    viewMode: ResultViewMode;
    onViewModeChange: (mode: ResultViewMode) => void;
    onExport: () => void;
};

export function SqlResults({ result, viewMode, onViewModeChange, onExport }: Props) {
    return (
        <div className="flex flex-col h-full bg-background">
            {/* Results toolbar */}
            <div className="flex items-center justify-between h-8 px-2 border-b border-sidebar-border bg-sidebar-accent/30 shrink-0">
                {/* View mode toggles */}
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-6 w-6",
                            viewMode === "table"
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-muted-foreground hover:text-sidebar-foreground"
                        )}
                        onClick={() => onViewModeChange("table")}
                        title="Table view"
                    >
                        <Table2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-6 w-6",
                            viewMode === "json"
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-muted-foreground hover:text-sidebar-foreground"
                        )}
                        onClick={() => onViewModeChange("json")}
                        title="JSON view"
                    >
                        <Braces className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Status */}
                {result && !result.error && (
                    <span className="text-xs text-muted-foreground">
                        {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} • {result.executionTime}ms
                    </span>
                )}

                {/* Export */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onExport}
                    disabled={!result || result.rows.length === 0}
                    title="Export results"
                >
                    <Download className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Results content */}
            <div className="flex-1 overflow-hidden">
                {!result ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Run a query to see results
                    </div>
                ) : result.error ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <div className="text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20 max-w-lg">
                            {result.error}
                        </div>
                    </div>
                ) : result.rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <span className="text-sm">No rows</span>
                        {result.affectedRows !== undefined && (
                            <span className="text-xs mt-1">{result.affectedRows} rows affected</span>
                        )}
                    </div>
                ) : viewMode === "json" ? (
                    <div className="relative h-full w-full">
                        <Editor
                            height="100%"
                            defaultLanguage="json"
                            value={JSON.stringify(result.rows, null, 2)}
                            theme="vs-dark"
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 2,
                                folding: true,
                                wordWrap: "on",
                                padding: { top: 12, bottom: 12 },
                                renderLineHighlight: "none",
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-sm border border-border hover:bg-background"
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2))}
                            title="Copy JSON"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-sidebar-accent">
                                <tr>
                                    <th className="w-8 px-2 py-1.5 text-center text-muted-foreground border-b border-r border-sidebar-border">
                                        #
                                    </th>
                                    {result.columns.map((col) => (
                                        <th
                                            key={col}
                                            className="px-3 py-1.5 text-left font-medium text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 whitespace-nowrap"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.map((row, rowIndex) => (
                                    <tr
                                        key={rowIndex}
                                        className="hover:bg-sidebar-accent/50 transition-colors"
                                    >
                                        <td className="px-2 py-1.5 text-center text-xs text-muted-foreground border-b border-r border-sidebar-border">
                                            {rowIndex + 1}
                                        </td>
                                        {result.columns.map((col) => (
                                            <td
                                                key={col}
                                                className="px-3 py-1.5 text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 font-mono whitespace-nowrap"
                                            >
                                                {formatCellValue(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "NULL";
    }
    if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}
