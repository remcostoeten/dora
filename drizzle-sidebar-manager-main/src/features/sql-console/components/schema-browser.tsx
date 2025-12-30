import { Search, Table2, Eye } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { TableInfo } from "../types";
import { useState } from "react";

type Props = {
    tables: TableInfo[];
    onTableSelect?: (tableName: string) => void;
};

function formatRowCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(count >= 10000 ? 1 : 2).replace(/\.?0+$/, "")}K`;
    }
    return count.toString();
}

export function SchemaBrowser({ tables, onTableSelect }: Props) {
    const [searchValue, setSearchValue] = useState("");

    const filteredTables = tables.filter((t) =>
        t.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full w-52 border-l border-sidebar-border bg-sidebar shrink-0">
            {/* Search */}
            <div className="p-2 border-b border-sidebar-border">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                        placeholder="Search tables..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-7 bg-transparent border-sidebar-border/60 text-xs pl-7"
                    />
                </div>
            </div>

            {/* Tables list */}
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {filteredTables.map((table) => (
                        <button
                            key={table.name}
                            className="group flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-sidebar-accent/50"
                            onClick={() => onTableSelect?.(table.name)}
                            title={`INSERT table: ${table.name}`}
                        >
                            {table.type === "view" ? (
                                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                                <Table2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 truncate text-sidebar-foreground">
                                {table.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {formatRowCount(table.rowCount)}
                            </span>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
