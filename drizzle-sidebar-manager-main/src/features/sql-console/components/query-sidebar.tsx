import { Search, FolderPlus, FilePlus, ChevronLeft, FileCode } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { SqlSnippet } from "../types";

type Props = {
    snippets: SqlSnippet[];
    activeSnippetId: string | null;
    onSnippetSelect: (id: string) => void;
    onNewSnippet: () => void;
    onBackToTables?: () => void;
};

export function QuerySidebar({
    snippets,
    activeSnippetId,
    onSnippetSelect,
    onNewSnippet,
    onBackToTables,
}: Props) {
    return (
        <div className="flex flex-col h-full w-56 border-r border-sidebar-border bg-sidebar shrink-0">
            {/* Header */}
            {onBackToTables && (
                <button
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-b border-sidebar-border"
                    onClick={onBackToTables}
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back to Tables</span>
                </button>
            )}

            {/* Search and actions */}
            <div className="flex items-center gap-1 p-2 border-b border-sidebar-border">
                <div className="relative flex-1">
                    <Input
                        placeholder="Search..."
                        className="h-7 bg-transparent border-sidebar-border/60 text-xs pl-2.5"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground shrink-0"
                    title="New folder"
                >
                    <FolderPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground shrink-0"
                    onClick={onNewSnippet}
                    title="New snippet"
                >
                    <FilePlus className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Snippets list */}
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {snippets.map((snippet) => (
                        <button
                            key={snippet.id}
                            className={cn(
                                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors",
                                activeSnippetId === snippet.id
                                    ? "bg-sidebar-accent text-sidebar-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                            onClick={() => onSnippetSelect(snippet.id)}
                        >
                            <FileCode className="h-4 w-4 shrink-0" />
                            <span className="truncate">{snippet.name}</span>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
