import { ChevronsUpDown, Plus, Settings, Database, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { Connection } from "../types";
import { AlertCircle } from "lucide-react";

type Props = {
    connections: Connection[];
    activeConnectionId?: string;
    onConnectionSelect: (id: string) => void;
    onAddConnection: () => void;
    onManageConnections: () => void;
};

export function ConnectionSwitcher({
    connections,
    activeConnectionId,
    onConnectionSelect,
    onAddConnection,
    onManageConnections,
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
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                            status === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                        )}>
                            {status === "error" ? (
                                <AlertCircle className="h-4 w-4" />
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
                                    status === "error" ? "Connection failed" : `${activeConnection.type} • ${activeConnection.host || "Local"}`
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
                        <DropdownMenuItem
                            key={connection.id}
                            onClick={() => onConnectionSelect(connection.id)}
                            className="gap-2 p-2"
                        >
                            <div className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background",
                                connection.status === "error" && "border-destructive/50 bg-destructive/5"
                            )}>
                                {connection.status === "error" ? (
                                    <AlertCircle className="h-3 w-3 text-destructive" />
                                ) : (
                                    <Database className="h-3 w-3 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 truncate text-sm">
                                {connection.name}
                            </div>
                            {connection.id === activeConnectionId && (
                                <Check className="h-4 w-4 text-primary ml-auto" />
                            )}
                        </DropdownMenuItem>
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
