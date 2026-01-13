import { BookOpen, PanelLeftClose, Loader2, Sparkles, Play, Download, Braces, Filter } from "lucide-react";
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
    onToggleCheatsheet?: () => void;
    showLeftSidebar: boolean;
    showCheatsheet?: boolean;
    isExecuting: boolean;
    mode: "sql" | "drizzle";
    onModeChange: (mode: "sql" | "drizzle") => void;
    onRun?: () => void;
    onPrettify?: () => void;
    onExport?: () => void;
    hasResults?: boolean;
    showJson?: boolean;
    onShowJsonToggle?: () => void;
    showFilter?: boolean;
    onToggleFilter?: () => void;
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
    onToggleCheatsheet,
    showLeftSidebar,
    showCheatsheet = false,
    isExecuting,
    mode,
    onModeChange,
    onRun,
    onPrettify,
    onExport,
    hasResults,
    showJson,
    onShowJsonToggle,
    showFilter,
    onToggleFilter,
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

            {/* Center - Editor Actions */}
            <div className="flex items-center gap-1 mx-4">
                {onRun && (
                    <Button
                        size="sm"
                        variant="default"
                        className={cn(
                            "h-7 px-3 gap-1.5 text-xs font-medium shadow-sm transition-all",
                            isExecuting
                                ? "bg-muted text-muted-foreground cursor-wait"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 active:scale-95"
                        )}
                        onClick={onRun}
                        disabled={isExecuting}
                    >
                        {isExecuting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Play className="h-3 w-3 fill-current" />
                        )}
                        <span>{isExecuting ? "Running..." : "Run"}</span>
                        <Kbd className="ml-1 bg-emerald-700/20 text-emerald-100 border-emerald-500/30">⌘+↵</Kbd>
                    </Button>
                )}

                <div className="w-px h-4 bg-border/50 mx-1" />

                {onPrettify && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={onPrettify}
                        title="Format code (Shift+Alt+F)"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                )}

                {onShowJsonToggle && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 text-muted-foreground hover:text-foreground",
                            showJson && "text-primary bg-primary/10"
                        )}
                        onClick={onShowJsonToggle}
                        title="Toggle JSON view"
                    >
                        <Braces className="h-3.5 w-3.5" />
                    </Button>
                )}

                {onToggleFilter && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 text-muted-foreground hover:text-foreground",
                            showFilter && "text-primary bg-primary/10"
                        )}
                        onClick={onToggleFilter}
                        title="Toggle filter"
                    >
                        <Filter className="h-3.5 w-3.5" />
                    </Button>
                )}

                {onExport && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 text-muted-foreground hover:text-foreground", !hasResults && "opacity-50 cursor-not-allowed")}
                        onClick={onExport}
                        disabled={!hasResults}
                        title="Export results as JSON"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                )}
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
            </div>
        </div>
    );
}
