import { Search, FolderPlus, FilePlus, ChevronLeft, FileCode, ChevronRight, Folder, Edit2, Trash2, MoreVertical } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { SqlSnippet } from "../types";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from "@/shared/ui/context-menu";

type Props = {
    snippets: SqlSnippet[];
    activeSnippetId: string | null;
    onSnippetSelect: (id: string) => void;
    onNewSnippet: (parentId?: string | null) => void;
    onNewFolder: (parentId?: string | null) => void;
    onRenameSnippet: (id: string, newName: string) => void;
    onDeleteSnippet: (id: string) => void;
    onBackToTables?: () => void;
};

export function QuerySidebar({
    snippets,
    activeSnippetId,
    onSnippetSelect,
    onNewSnippet,
    onNewFolder,
    onRenameSnippet,
    onDeleteSnippet,
    onBackToTables,
}: Props) {
    const [searchValue, setSearchValue] = useState("");
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [originalEditValue, setOriginalEditValue] = useState("");
    const editInputRef = useRef<HTMLInputElement>(null);

    const toggleFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const startRenaming = (node: SqlSnippet) => {
        setEditingId(node.id);
        setEditValue(node.name);
        setOriginalEditValue(node.name);
    };

    const handleRenameSubmit = () => {
        if (editingId && editValue.trim()) {
            onRenameSnippet(editingId, editValue.trim());
        }
        setEditingId(null);
    };

    const handleRenameUndo = () => {
        setEditValue(originalEditValue);
    };

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const tree = useMemo(() => {
        const buildTree = (parentId: string | null = null): SqlSnippet[] => {
            return snippets
                .filter(s => s.parentId === parentId)
                .sort((a, b) => {
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    return a.name.localeCompare(b.name);
                });
        };
        return buildTree(null);
    }, [snippets]);

    const renderNode = (node: SqlSnippet, depth: number = 0) => {
        const isExpanded = expandedFolders[node.id];
        const children = snippets.filter(s => s.parentId === node.id);
        const isActive = activeSnippetId === node.id;
        const isEditing = editingId === node.id;

        const NodeContent = (
            <div className="flex items-center gap-1 flex-1 min-w-0">
                {node.isFolder ? (
                    <>
                        {isExpanded ? (
                            <ChevronRight className="h-3.5 w-3.5 rotate-90 transition-transform shrink-0" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 transition-transform shrink-0" />
                        )}
                        <Folder className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
                    </>
                ) : (
                    <FileCode className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}

                {isEditing ? (
                    <Input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSubmit();
                            if (e.key === "Escape") setEditingId(null);
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                                e.preventDefault();
                                handleRenameUndo();
                            }
                        }}
                        className="h-6 py-0 px-1 text-xs bg-sidebar-accent border-primary"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate">{node.name}</span>
                )}
            </div>
        );

        return (
            <ContextMenu key={node.id}>
                <ContextMenuTrigger>
                    <div key={node.id}>
                        <button
                            className={cn(
                                "group flex items-center gap-1.5 w-full px-2 py-1 text-sm text-left transition-colors hover:bg-sidebar-accent/50",
                                isActive && !node.isFolder
                                    ? "bg-sidebar-accent text-sidebar-foreground border-r-2 border-primary"
                                    : (isActive ? "text-sidebar-foreground" : "text-muted-foreground hover:text-sidebar-foreground")
                            )}
                            style={{ paddingLeft: `${depth * 12 + (node.isFolder ? 8 : 24)}px` }}
                            onClick={() => node.isFolder ? toggleFolder(node.id, {} as any) : onSnippetSelect(node.id)}
                        >
                            {NodeContent}
                            {!isEditing && (
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto">
                                    {node.isFolder && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 hover:bg-sidebar-accent"
                                                onClick={(e) => { e.stopPropagation(); onNewSnippet(node.id); }}
                                                title="New snippet in folder"
                                            >
                                                <FilePlus className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 hover:bg-sidebar-accent"
                                                onClick={(e) => { e.stopPropagation(); onNewFolder(node.id); }}
                                                title="New folder in folder"
                                            >
                                                <FolderPlus className="h-3 w-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                        </button>
                        {node.isFolder && isExpanded && children.map(child => renderNode(child, depth + 1))}
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={() => startRenaming(node)}>
                        <Edit2 className="h-3.5 w-3.5" />
                        Rename
                    </ContextMenuItem>
                    {node.isFolder && (
                        <>
                            <ContextMenuItem onClick={() => onNewSnippet(node.id)}>
                                <FilePlus className="h-3.5 w-3.5" />
                                New Snippet
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onNewFolder(node.id)}>
                                <FolderPlus className="h-3.5 w-3.5" />
                                New Folder
                            </ContextMenuItem>
                        </>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteSnippet(node.id)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
    };

    return (
        <div className="flex flex-col h-full w-full border-r border-sidebar-border bg-sidebar overflow-hidden">
            {/* Header */}
            {onBackToTables && (
                <button
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-b border-sidebar-border h-9"
                    onClick={onBackToTables}
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back to Tables</span>
                </button>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-1 p-2 border-b border-sidebar-border shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
                    Snippets
                </span>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground shrink-0"
                        onClick={() => onNewFolder(null)}
                        title="New root folder"
                    >
                        <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground shrink-0"
                        onClick={() => onNewSnippet(null)}
                        title="New root snippet"
                    >
                        <FilePlus className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-sidebar-border shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                        placeholder="Search queries..."
                        className="h-7 bg-transparent border-sidebar-border/60 text-xs pl-7"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                </div>
            </div>

            {/* Snippets list */}
            <ScrollArea className="flex-1">
                <div className="py-2">
                    {tree.map(node => renderNode(node))}
                </div>
            </ScrollArea>
        </div>
    );
}
