import { Sparkles, Play, ChevronDown, PanelLeftClose, PanelRightClose, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type Props = {
    onRun: () => void;
    onRunSelection?: () => void;
    onPrettify: () => void;
    onToggleLeftSidebar: () => void;
    onToggleRightSidebar: () => void;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    isExecuting: boolean;
};

export function ConsoleToolbar({
    onRun,
    onRunSelection,
    onPrettify,
    onToggleLeftSidebar,
    onToggleRightSidebar,
    showLeftSidebar,
    showRightSidebar,
    isExecuting,
}: Props) {
    return (
        <div className="flex items-center justify-between h-10 px-3 border-b border-sidebar-border bg-sidebar shrink-0">
            {/* Left side - sidebar toggles */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onToggleLeftSidebar}
                    title={showLeftSidebar ? "Hide query panel" : "Show query panel"}
                >
                    <PanelLeftClose className={showLeftSidebar ? "" : "rotate-180"} style={{ width: 16, height: 16 }} />
                </Button>
            </div>

            {/* Center - actions */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-sidebar-foreground"
                    onClick={onPrettify}
                    title="Prettify (Shift+Alt+F)"
                >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Prettify
                </Button>

                <div className="flex items-center">
                    <Button
                        size="sm"
                        className="h-7 px-3 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 rounded-r-none"
                        onClick={onRun}
                        disabled={isExecuting}
                    >
                        {isExecuting ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                        )}
                        Run
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                className="h-7 px-1.5 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 rounded-l-none border-l border-sidebar-primary-foreground/20"
                                disabled={isExecuting}
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onRun}>
                                Run all (Ctrl+Enter)
                            </DropdownMenuItem>
                            {onRunSelection && (
                                <DropdownMenuItem onClick={onRunSelection}>
                                    Run selection
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Right side - sidebar toggle */}
            <div className="flex items-center gap-1">
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
