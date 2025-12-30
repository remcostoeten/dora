import { SchemaTable } from "../types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Table2, Key, Hash, Type, CircleDot } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useState } from "react";

type Props = {
    tables: SchemaTable[];
};

export function SchemaViewer({ tables }: Props) {
    const [expandedTable, setExpandedTable] = useState<string | null>(tables[0]?.name || null);

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
                {tables.map((table) => (
                    <div
                        key={table.name}
                        className="border border-sidebar-border rounded-lg overflow-hidden"
                    >
                        {/* Table header */}
                        <button
                            className={cn(
                                "flex items-center gap-2 w-full px-3 py-2 text-left transition-colors",
                                expandedTable === table.name
                                    ? "bg-sidebar-accent text-sidebar-foreground"
                                    : "bg-sidebar-accent/50 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                            onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                        >
                            <Table2 className="h-4 w-4 shrink-0" />
                            <span className="font-medium text-sm">{table.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {table.columns.length} columns
                            </span>
                        </button>

                        {/* Columns */}
                        {expandedTable === table.name && (
                            <div className="divide-y divide-sidebar-border">
                                {table.columns.map((col) => (
                                    <div
                                        key={col.name}
                                        className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-sidebar-accent/30 transition-colors"
                                    >
                                        {/* Column icon */}
                                        <div className="shrink-0">
                                            {col.primaryKey ? (
                                                <Key className="h-3.5 w-3.5 text-yellow-400" />
                                            ) : col.type.includes("int") || col.type.includes("decimal") ? (
                                                <Hash className="h-3.5 w-3.5 text-blue-400" />
                                            ) : col.type.includes("bool") ? (
                                                <CircleDot className="h-3.5 w-3.5 text-purple-400" />
                                            ) : (
                                                <Type className="h-3.5 w-3.5 text-green-400" />
                                            )}
                                        </div>

                                        {/* Column name */}
                                        <span className="font-mono text-sidebar-foreground flex-1">
                                            {col.name}
                                        </span>

                                        {/* Column type */}
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {col.type}
                                        </span>

                                        {/* Nullable indicator */}
                                        {col.nullable && (
                                            <span className="text-xs text-muted-foreground/60 px-1.5 py-0.5 rounded bg-sidebar-accent">
                                                null
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
