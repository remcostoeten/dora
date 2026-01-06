import { BookOpen, PanelLeftClose, PanelRightClose, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type Props = {
    onToggleLeftSidebar: () => void;
    onToggleRightSidebar: () => void;
    onToggleCheatsheet?: () => void;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    showCheatsheet?: boolean;
    isExecuting: boolean;
    mode: "sql" | "drizzle";
    onModeChange: (mode: "sql" | "drizzle") => void;
};

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <kbd className={cn(
            "pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
            className
        )}>
            {children}
        </kbd>
    );
}

export function ConsoleToolbar({
    onToggleLeftSidebar,
    onToggleRightSidebar,
    onToggleCheatsheet,
    showLeftSidebar,
    showRightSidebar,
    showCheatsheet = false,
    isExecuting,
    mode,
    onModeChange,
}: Props) {
    return (
        <div className="flex items-center justify-between h-10 px-3 border-b border-sidebar-border bg-sidebar shrink-0">
            {/* Left side - sidebar toggles */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onToggleLeftSidebar}
                    title={showLeftSidebar ? "Hide query panel" : "Show query panel"}
                >
                    <PanelLeftClose className={showLeftSidebar ? "" : "rotate-180"} style={{ width: 16, height: 16 }} />
                </Button>

                {/* Mode Switcher - Tab Style */}
                <div className="flex items-end h-full ml-4 self-stretch">
                    <button
                        onClick={() => onModeChange?.("sql")}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all border-b-2",
                            mode === "sql"
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        SQL
                        <Kbd>S</Kbd>
                    </button>
                    <button
                        onClick={() => onModeChange?.("drizzle")}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all border-b-2",
                            mode === "drizzle"
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Drizzle
                        <Kbd>D</Kbd>
                    </button>
                </div>
            </div>

            {/* Right side - sidebar toggle */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 text-xs gap-1.5", showCheatsheet && "bg-sidebar-accent")}
                    onClick={onToggleCheatsheet}
                    title="Toggle cheatsheet"
                >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cheatsheet</span>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onToggleRightSidebar}
                    title={showRightSidebar ? "Hide schema browser" : "Show schema browser"}
                >
                    <PanelRightClose className={showRightSidebar ? "" : "rotate-180"} style={{ width: 16, height: 16 }} />
                </Button>
            </div>
        </div>
    );
}
