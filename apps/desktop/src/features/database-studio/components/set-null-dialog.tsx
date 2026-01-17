import { useState } from "react";
import { StudioDialog } from "./studio-dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import type { ColumnDefinition } from "../types";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: ColumnDefinition[];
    selectedCount: number;
    onSubmit: (columnName: string) => void;
    isLoading?: boolean;
};

export function SetNullDialog({
    open,
    onOpenChange,
    columns,
    selectedCount,
    onSubmit,
    isLoading = false,
}: Props) {
    const [selectedColumn, setSelectedColumn] = useState<string>("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedColumn) return;
        onSubmit(selectedColumn);
    }

    function handleOpenChange(isOpen: boolean) {
        if (!isOpen) {
            setSelectedColumn("");
        }
        onOpenChange(isOpen);
    }

    // Only show nullable columns that aren't primary keys
    const nullableColumns = columns.filter(function (c) {
        return c.nullable && !c.primaryKey;
    });

    return (
        <StudioDialog
            open={open}
            onOpenChange={handleOpenChange}
            title="Set Column to NULL"
            description={`Set a column value to NULL for ${selectedCount} selected row${selectedCount !== 1 ? "s" : ""}.`}
            className="sm:max-w-[425px]"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={function () { handleOpenChange(false); }}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="destructive"
                        disabled={!selectedColumn || isLoading || nullableColumns.length === 0}
                        form="set-null-form"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Set to NULL
                    </Button>
                </>
            }
        >
            <form id="set-null-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="column">Column</Label>
                    <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                        <SelectTrigger id="column">
                            <SelectValue placeholder="Select a column" />
                        </SelectTrigger>
                        <SelectContent>
                            {nullableColumns.length === 0 ? (
                                <div className="py-2 px-3 text-sm text-muted-foreground">
                                    No nullable columns available
                                </div>
                            ) : (
                                nullableColumns.map(function (col) {
                                    return (
                                        <SelectItem key={col.name} value={col.name}>
                                            <div className="flex items-center gap-2">
                                                <span>{col.name}</span>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {col.type}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    );
                                })
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {selectedColumn && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">
                            This will set the "{selectedColumn}" column to NULL for all {selectedCount} selected rows. This action cannot be undone.
                        </p>
                    </div>
                )}
            </form>
        </StudioDialog>
    );
}
