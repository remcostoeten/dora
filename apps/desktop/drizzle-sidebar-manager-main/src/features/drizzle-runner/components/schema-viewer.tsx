import { SchemaTable } from "../types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Table2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useState } from "react";

type Props = {
    tables: SchemaTable[];
};

export function SchemaViewer({ tables }: Props) {
    const [expandedTable, setExpandedTable] = useState<string | null>(tables[0]?.name || null);

    return (
        <ScrollArea className="h-full bg-sidebar">
            <div className="p-2 space-y-1">
                {tables.map((table) => (
                    <div
                        key={table.name}
                        className="rounded-md overflow-hidden"
                    >
                        {/* Table header */}
                        <button
                            className={cn(
                                "flex items-center gap-2 w-full px-2 py-1.5 text-left transition-colors text-sm rounded-md",
                                expandedTable === table.name
                                    ? "bg-sidebar-accent text-sidebar-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                            onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                        >
                            {expandedTable === table.name ? (
                                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                            ) : (
                                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                            )}
                            <Table2 className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="font-medium truncate">{table.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground/50 tabular-nums">
                                {table.columns.length}
                            </span>
                        </button>

                        {/* Columns */}
                        {expandedTable === table.name && (
                            <div className="ml-4 pl-2 border-l border-sidebar-border/50 my-1 space-y-0.5">
                                {table.columns.map((col) => (
                                    <div
                                        key={col.name}
                                        className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors cursor-default"
                                    >
                                        <span className="font-mono flex-1 truncate">
                                            {col.name}
                                        </span>
                                        <span className="font-mono text-[10px] text-muted-foreground/50">
                                            {col.type}
                                        </span>
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
