import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Loader2 } from "lucide-react";
import type { ColumnDefinition } from "../types";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: ColumnDefinition[];
    selectedCount: number;
    onSubmit: (columnName: string, value: unknown) => void;
    isLoading?: boolean;
};

export function BulkEditDialog({
    open,
    onOpenChange,
    columns,
    selectedCount,
    onSubmit,
    isLoading = false,
}: Props) {
    const [selectedColumn, setSelectedColumn] = useState<string>("");
    const [newValue, setNewValue] = useState<string>("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedColumn) return;

        const column = columns.find(function (c) { return c.name === selectedColumn; });
        if (!column) return;

        // Convert value based on column type
        let parsedValue: unknown = newValue;
        const type = column.type.toLowerCase();

        if (newValue === "" && column.nullable) {
            parsedValue = null;
        } else if (type.includes("int") || type.includes("serial")) {
            parsedValue = parseInt(newValue, 10);
            if (isNaN(parsedValue as number)) parsedValue = newValue;
        } else if (type.includes("float") || type.includes("double") || type.includes("decimal") || type.includes("numeric")) {
            parsedValue = parseFloat(newValue);
            if (isNaN(parsedValue as number)) parsedValue = newValue;
        } else if (type.includes("bool")) {
            parsedValue = newValue.toLowerCase() === "true" || newValue === "1";
        }

        onSubmit(selectedColumn, parsedValue);
    }

    function handleOpenChange(isOpen: boolean) {
        if (!isOpen) {
            setSelectedColumn("");
            setNewValue("");
        }
        onOpenChange(isOpen);
    }

    // Filter out primary key columns - can't bulk edit those
    const editableColumns = columns.filter(function (c) { return !c.primaryKey; });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Bulk Edit</DialogTitle>
                    <DialogDescription>
                        Set a new value for {selectedCount} selected row{selectedCount !== 1 ? "s" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="column">Column</Label>
                        <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                            <SelectTrigger id="column">
                                <SelectValue placeholder="Select a column" />
                            </SelectTrigger>
                            <SelectContent>
                                {editableColumns.map(function (col) {
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
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="value">New Value</Label>
                        <Input
                            id="value"
                            value={newValue}
                            onChange={function (e) { setNewValue(e.target.value); }}
                            placeholder="Enter new value (leave empty for NULL)"
                            disabled={!selectedColumn}
                        />
                        {selectedColumn && (
                            <p className="text-xs text-muted-foreground">
                                This will update the "{selectedColumn}" column for all {selectedCount} selected rows.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={function () { handleOpenChange(false); }}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedColumn || isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Update {selectedCount} Row{selectedCount !== 1 ? "s" : ""}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
