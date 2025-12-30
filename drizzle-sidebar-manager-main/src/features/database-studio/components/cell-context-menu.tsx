import { Copy, Filter, Clipboard, FileJson } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { ColumnDefinition } from "../types";

type CellAction = "copy" | "copy-json" | "filter-by-value";

type Props = {
    value: unknown;
    column: ColumnDefinition;
    onAction?: (action: CellAction, value: unknown, column: ColumnDefinition) => void;
    children: React.ReactNode;
};

export function CellContextMenu({ value, column, onAction, children }: Props) {
    const handleCopy = () => {
        const text = value === null || value === undefined ? "" : String(value);
        navigator.clipboard.writeText(text);
        onAction?.("copy", value, column);
    };

    const handleCopyJson = () => {
        const json = JSON.stringify(value, null, 2);
        navigator.clipboard.writeText(json);
        onAction?.("copy-json", value, column);
    };

    const handleFilterByValue = () => {
        onAction?.("filter-by-value", value, column);
    };

    const isComplexType = typeof value === "object" && value !== null;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-[180px]">
                <ContextMenuItem onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    <span>Copy value</span>
                </ContextMenuItem>
                {isComplexType && (
                    <ContextMenuItem onClick={handleCopyJson}>
                        <FileJson className="h-4 w-4 mr-2" />
                        <span>Copy as JSON</span>
                    </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleFilterByValue}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span>Filter by this value</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export type { CellAction };
