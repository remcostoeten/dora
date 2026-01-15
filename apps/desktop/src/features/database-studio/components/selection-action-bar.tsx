import { Trash2, Copy, X, Ban } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type Props = {
    selectedCount: number;
    onDelete?: () => void;
    onCopy?: () => void;
    onSetNull?: () => void;
    onClearSelection: () => void;
};

export function SelectionActionBar({
    selectedCount,
    onDelete,
    onCopy,
    onSetNull,
    onClearSelection,
}: Props) {
    if (selectedCount === 0) return null;

    return (
        <div className={cn(
            "flex items-center justify-between h-10 px-3 bg-primary/10 border-t border-primary/20 shrink-0",
            "animate-in slide-in-from-bottom-2 duration-200"
        )}>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {selectedCount}
                    </span>
                    <span>row{selectedCount !== 1 ? "s" : ""} selected</span>
                </div>
                
                <div className="h-4 w-px bg-primary/20" />

                <div className="flex items-center gap-1">
                    {onCopy && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1.5 text-primary hover:bg-primary/20"
                            onClick={onCopy}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </Button>
                    )}
                    
                    {onSetNull && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1.5 text-primary hover:bg-primary/20"
                            onClick={onSetNull}
                        >
                            <Ban className="h-3.5 w-3.5" />
                            Set NULL
                        </Button>
                    )}

                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1.5 text-destructive hover:bg-destructive/20"
                            onClick={onDelete}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onClearSelection}
                title="Clear selection"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
