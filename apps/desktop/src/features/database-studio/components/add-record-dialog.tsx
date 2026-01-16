import { useState, useEffect } from "react";
import { StudioDialog } from "./studio-dialog";
import { Button } from "@/shared/ui/button";
import { Loader2 } from "lucide-react";
import type { ColumnDefinition } from "../types";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: ColumnDefinition[];
    onSubmit: (rowData: Record<string, unknown>) => void;
    isLoading?: boolean;
    initialData?: Record<string, unknown>;
    mode?: "add" | "duplicate";
};

export function AddRecordDialog({
    open,
    onOpenChange,
    columns,
    onSubmit,
    isLoading,
    initialData,
    mode = "add"
}: Props) {
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(function resetFormOnOpen() {
        if (open) {
            const initial: Record<string, string> = {};
            columns.forEach(function initColumn(col) {
                if (initialData && initialData[col.name] !== undefined) {
                    initial[col.name] = String(initialData[col.name] ?? "");
                } else {
                    initial[col.name] = "";
                }
            });
            setFormData(initial);
        }
    }, [open, columns, initialData]);

    function handleFieldChange(columnName: string, value: string) {
        setFormData(function updateField(prev) {
            return { ...prev, [columnName]: value };
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const parsed: Record<string, unknown> = {};
        columns.forEach(function parseColumn(col) {
            const value = formData[col.name];
            if (value === "" && col.nullable) {
                parsed[col.name] = null;
            } else if (col.type.toLowerCase().includes("int") || col.type.toLowerCase().includes("serial")) {
                const num = parseInt(value, 10);
                parsed[col.name] = isNaN(num) ? (col.nullable ? null : 0) : num;
            } else if (col.type.toLowerCase().includes("float") || col.type.toLowerCase().includes("double") || col.type.toLowerCase().includes("decimal") || col.type.toLowerCase().includes("numeric")) {
                const num = parseFloat(value);
                parsed[col.name] = isNaN(num) ? (col.nullable ? null : 0) : num;
            } else if (col.type.toLowerCase().includes("bool")) {
                parsed[col.name] = value.toLowerCase() === "true" || value === "1";
            } else {
                parsed[col.name] = value;
            }
        });
        onSubmit(parsed);
    }

    const editableColumns = columns.filter(function isEditable(col) {
        const isPrimaryAutoIncrement = col.primaryKey && (
            col.type.toLowerCase().includes("serial") ||
            col.type.toLowerCase().includes("autoincrement")
        );
        return !isPrimaryAutoIncrement;
    });

    return (
        <StudioDialog
            open={open}
            onOpenChange={onOpenChange}
            title={mode === "duplicate" ? "Duplicate Record" : "Add New Record"}
            description="Fill in the values for the new record. Primary key fields with auto-increment are excluded."
            className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            contentClassName="flex flex-col overflow-hidden p-0"
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={function handleCancel() {
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        form="add-record-form"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : mode === "duplicate" ? (
                            "Duplicate"
                        ) : (
                            "Add Record"
                        )}
                    </Button>
                </>
            }
        >
            <form id="add-record-form" onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden h-full">
                <div className="flex-1 overflow-y-auto space-y-4 p-4">
                    {editableColumns.map(function renderField(col) {
                        return (
                            <div key={col.name} className="grid grid-cols-3 items-center gap-4">
                                <label
                                    htmlFor={col.name}
                                    className="text-sm font-medium text-muted-foreground text-right"
                                >
                                    {col.name}
                                    {!col.nullable && <span className="text-destructive ml-1">*</span>}
                                </label>
                                <div className="col-span-2">
                                    <input
                                        id={col.name}
                                        type="text"
                                        value={formData[col.name] || ""}
                                        onChange={function onFieldInput(e) {
                                            handleFieldChange(col.name, e.target.value);
                                        }}
                                        placeholder={col.nullable ? "NULL" : `Enter ${col.type}`}
                                        required={!col.nullable}
                                        className="w-full h-9 px-3 rounded-md border border-sidebar-border bg-sidebar text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <span className="text-xs text-muted-foreground mt-1">
                                        {col.type}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </form>
        </StudioDialog>
    );
}
