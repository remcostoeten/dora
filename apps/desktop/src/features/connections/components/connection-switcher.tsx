import { ChevronsUpDown, Plus, Settings, Database, Check, Eye, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { cn } from "@/shared/utils/cn";
import { Connection, DatabaseType } from "../types";
import { DatabaseTypeIcon } from "./database-type-icon";

function formatDatabaseType(type: DatabaseType | undefined): string {
    if (!type) return "Database";
    switch (type.toLowerCase()) {
        case "postgres":
        case "postgresql":
            return "PostgreSQL";
        case "sqlite":
            return "SQLite";
        case "libsql":
        case "turso":
            return "Turso";
        case "mysql":
            return "MySQL";
        default:
            return type.charAt(0).toUpperCase() + type.slice(1);
    }
}

type Props = {
    connections: Connection[];
    activeConnectionId?: string;
    onConnectionSelect: (id: string) => void;
    onAddConnection: () => void;
    onManageConnections: () => void;
    onViewConnection?: (id: string) => void;
    onEditConnection?: (id: string) => void;
    onDeleteConnection?: (id: string) => void;
};

export function ConnectionSwitcher({
    connections,
    activeConnectionId,
    onConnectionSelect,
    onAddConnection,
    onManageConnections,
    onViewConnection,
    onEditConnection,
    onDeleteConnection,
}: Props) {
    const activeConnection = connections.find((c) => c.id === activeConnectionId);
    const status = activeConnection?.status || "idle";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="lg"
                    className="w-full justify-between px-3 py-6 hover:bg-sidebar-accent text-sidebar-foreground group"
                >
                    <div className="flex items-center gap-3 text-left">
                        <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0",
                            status === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                        )}>
                            {status === "error" ? (
                                <AlertCircle className="h-4 w-4" />
                            ) : activeConnection ? (
                                <DatabaseTypeIcon type={activeConnection.type} className="h-4 w-4" />
                            ) : (
                                <Database className="h-4 w-4" />
                            )}
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className={cn(
                                "truncate font-semibold",
                                status === "error" ? "text-destructive" : "text-foreground"
                            )}>
                                {activeConnection?.name || "Select Database"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {activeConnection ? (
                                    status === "error" ? "Connection failed" : `${formatDatabaseType(activeConnection.type)} • ${activeConnection.host || "Local"}`
                                ) : "No connection"}
                            </span>
                        </div>
                    </div>
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-[240px] min-w-[240px]"
                align="start"
                side="bottom"
                sideOffset={4}
            >
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Databases
                </DropdownMenuLabel>

                {connections.length > 0 ? (
                    connections.map((connection) => (
                        <ContextMenu key={connection.id}>
                            <ContextMenuTrigger asChild>
                                <DropdownMenuItem
                                    onClick={function () { onConnectionSelect(connection.id); }}
                                    className="gap-2 p-2 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <div className={cn(
                                            "flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background",
                                            connection.status === "error" && "border-destructive/50 bg-destructive/5"
                                        )}>
                                            {connection.status === "error" ? (
                                                <AlertCircle className="h-3 w-3 text-destructive" />
                                            ) : (
                                                <DatabaseTypeIcon type={connection.type} className="h-3 w-3 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 truncate text-sm">
                                            {connection.name}
                                        </div>
                                        {connection.id === activeConnectionId && (
                                            <Check className="h-4 w-4 text-primary ml-auto" />
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                                <ContextMenuItem
                                    onSelect={() => onViewConnection?.(connection.id)}
                                    className="gap-2 cursor-pointer"
                                >
                                    <Eye className="h-4 w-4" />
                                    View Details
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onSelect={() => onEditConnection?.(connection.id)}
                                    className="gap-2 cursor-pointer"
                                >
                                    <Pencil className="h-4 w-4" />
                                    Edit Connection
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    onSelect={() => onDeleteConnection?.(connection.id)}
                                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Connection
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    ))
                ) : (
                    <div className="px-2 py-3 text-xs text-center text-muted-foreground border border-dashed rounded-md m-1">
                        No connections found
                    </div>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onAddConnection} className="gap-2 p-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background">
                        <Plus className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="font-medium text-muted-foreground">Add connection</div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onManageConnections} className="gap-2 p-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background">
                        <Settings className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="font-medium text-muted-foreground">Manage connections</div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
