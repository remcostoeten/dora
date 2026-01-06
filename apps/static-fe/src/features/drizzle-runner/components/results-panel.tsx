import { QueryResult } from "../types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Button } from "@/shared/ui/button";
import { Copy } from "lucide-react";

type Props = {
    result: QueryResult | null;
    showJson: boolean;
};

export function ResultsPanel({ result, showJson }: Props) {
    if (!result) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Run a query to see results
            </div>
        );
    }

    if (result.error) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20">
                    {result.error}
                </div>
            </div>
        );
    }

    if (result.rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <span className="text-sm">No rows</span>
                <span className="text-xs mt-1">Query executed in {result.executionTime}ms</span>
            </div>
        );
    }

    if (showJson) {
        return (
            <div className="relative h-full">
                <ScrollArea className="h-full">
                    <pre className="p-4 text-sm font-mono text-sidebar-foreground whitespace-pre-wrap">
                        {JSON.stringify(result.rows, null, 2)}
                    </pre>
                </ScrollArea>
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-xs border border-border hover:bg-background z-10"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2))}
                    title="Copy JSON"
                >
                    <Copy className="h-3.5 w-3.5" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-sidebar-border text-xs text-muted-foreground">
                <span>{result.rowCount} row{result.rowCount !== 1 ? "s" : ""}</span>
                <span>{result.executionTime}ms</span>
            </div>

            {/* Data table */}
            <ScrollArea className="flex-1">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-sidebar-accent">
                        <tr>
                            {result.columns.map((col) => (
                                <th
                                    key={col}
                                    className="px-3 py-2 text-left font-medium text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0"
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
                                {result.columns.map((col) => (
                                    <td
                                        key={col}
                                        className="px-3 py-2 text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 font-mono"
                                    >
                                        {formatCellValue(row[col])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ScrollArea>
        </div>
    );
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "NULL";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}
