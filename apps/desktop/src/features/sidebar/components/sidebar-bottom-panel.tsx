import { TableInfo } from "@/lib/bindings";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Key, Link, Hash, Type, TextQuote, Lock, Calendar } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Props = {
    table: TableInfo;
    height?: number;
};

function getColumnIcon(type: string, isPk?: boolean, isFk?: boolean) {
    if (isPk) return Key;
    if (isFk) return Link;

    const t = type.toLowerCase();
    if (t.includes("int") || t.includes("float") || t.includes("numeric") || t.includes("serial")) return Hash;
    if (t.includes("char") || t.includes("text")) return Type;
    if (t.includes("date") || t.includes("time") || t.includes("year")) return Calendar;
    if (t.includes("bool")) return Lock; // or some other icon

    return TextQuote;
}

export function SidebarBottomPanel({ table, height }: Props) {
    return (
        <div
            className="flex flex-col border-t border-sidebar-border bg-sidebar shrink-0"
            style={{ height: height ?? "40%", minHeight: 150 }}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border bg-sidebar/50">
                <span className="text-xs font-medium text-sidebar-foreground">STRUCTURE</span>
                <span className="text-xs text-muted-foreground">{table.columns.length} columns</span>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col py-1">
                    {table.columns.map((col) => {
                        const Icon = getColumnIcon(col.data_type, col.is_primary_key, !!col.foreign_key);

                        return (
                            <div key={col.name} className="flex items-center gap-2 px-3 py-1.5 text-xs group hover:bg-sidebar-accent/50 transition-colors">
                                <Icon className={cn(
                                    "h-3 w-3 shrink-0",
                                    col.is_primary_key ? "text-amber-500" :
                                        col.foreign_key ? "text-blue-500" :
                                            "text-muted-foreground"
                                )} />
                                <span className={cn(
                                    "font-medium truncate flex-1",
                                    (col.is_primary_key || col.foreign_key) ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground"
                                )}>
                                    {col.name}
                                </span>
                                <span className="text-muted-foreground/60 font-mono text-[10px] shrink-0">
                                    {col.data_type}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            <div className="flex items-center border-t border-sidebar-border px-3 py-1.5 bg-sidebar/50 cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
                <span className="text-xs font-medium text-muted-foreground">INDEXES</span>
                <span className="ml-auto text-xs text-muted-foreground/60">
                    {table.primary_key_columns?.length || 0}
                </span>
            </div>
        </div>
    );
}
