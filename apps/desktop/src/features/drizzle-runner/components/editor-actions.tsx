import { Sparkles, Braces, Download, Loader2, Play } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type Props = {
    onRun?: () => void;
    showJson?: boolean;
    onShowJsonToggle?: () => void;
    onPrettify?: () => void;
    onExport?: () => void;
    isExecuting: boolean;
    hasResults?: boolean;
};

export function EditorActions({
    onRun,
    showJson,
    onShowJsonToggle,
    onPrettify,
    onExport,
    isExecuting,
    hasResults,
}: Props) {
    return (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
            {onPrettify && (
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2.5 gap-1.5 text-xs bg-background/90 backdrop-blur-xs border border-border/60 hover:bg-muted shadow-xs"
                    onClick={onPrettify}
                    title="Format code (Shift+Alt+F)"
                >
                    <Sparkles className="h-3 w-3" />
                    <span>Format</span>
                </Button>
            )}

            {onRun && (
                <Button
                    size="sm"
                    className={cn(
                        "h-7 px-3 gap-1.5 text-xs font-medium shadow-xs",
                        isExecuting
                            ? "bg-muted text-muted-foreground cursor-wait"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
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
                </Button>
            )}

            {(onShowJsonToggle || onExport) && (
                <div className="h-4 w-px bg-border/50" />
            )}

            {onShowJsonToggle && (
                <Button
                    variant="secondary"
                    size="icon"
                    className={cn(
                        "h-7 w-7 bg-background/90 backdrop-blur-xs border border-border/60 shadow-xs",
                        showJson ? "text-primary bg-primary/10 border-primary/30" : "hover:bg-muted"
                    )}
                    onClick={onShowJsonToggle}
                    title="Toggle JSON view"
                >
                    <Braces className="h-3 w-3" />
                </Button>
            )}

            {onExport && (
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-background/90 backdrop-blur-xs border border-border/60 hover:bg-muted shadow-xs"
                    onClick={onExport}
                    disabled={!hasResults}
                    title="Export results as JSON"
                >
                    <Download className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}
