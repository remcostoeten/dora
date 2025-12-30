import { Sparkles, Braces, Download, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type Props = {
    showJson: boolean;
    onShowJsonToggle: () => void;
    onPrettify: () => void;
    onExport: () => void;
    isExecuting: boolean;
    hasResults: boolean;
};

export function EditorActions({
    showJson,
    onShowJsonToggle,
    onPrettify,
    onExport,
    isExecuting,
    hasResults,
}: Props) {
    return (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {isExecuting && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Executing...</span>
                </div>
            )}

            <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 bg-sidebar-accent border-sidebar-border text-muted-foreground hover:text-sidebar-foreground"
                onClick={onPrettify}
                title="Prettify code"
            >
                <Sparkles className="h-3.5 w-3.5" />
            </Button>

            <Button
                variant="outline"
                size="sm"
                className={cn(
                    "h-7 px-3 bg-sidebar-accent border-sidebar-border text-muted-foreground hover:text-sidebar-foreground",
                    showJson && "bg-sidebar-primary text-sidebar-primary-foreground"
                )}
                onClick={onShowJsonToggle}
            >
                <Braces className="h-3.5 w-3.5 mr-1.5" />
                JSON
            </Button>

            <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 bg-sidebar-accent border-sidebar-border text-muted-foreground hover:text-sidebar-foreground"
                onClick={onExport}
                disabled={!hasResults}
                title="Export results"
            >
                <Download className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
