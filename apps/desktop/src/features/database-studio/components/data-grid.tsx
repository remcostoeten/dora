import { useState, useRef, useCallback, useEffect } from "react";
import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { ColumnDefinition, SortDescriptor, FilterDescriptor } from "../types";
import { CellContextMenu } from "./cell-context-menu";
import { RowContextMenu, type RowAction } from "./row-context-menu";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type EditingCell = {
    rowIndex: number;
    columnName: string;
};

type Props = {
    columns: ColumnDefinition[];
    rows: Record<string, unknown>[];
    selectedRows: Set<number>;
    onRowSelect: (rowIndex: number, checked: boolean) => void;
    onRowsSelect?: (rowIndices: number[], checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    sort?: SortDescriptor;
    onSortChange?: (sort: SortDescriptor | undefined) => void;
    onFilterAdd?: (filter: FilterDescriptor) => void;
    onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void;
    onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void;
    onRowAction?: (action: RowAction, row: Record<string, unknown>, rowIndex: number) => void;
    tableName?: string;
};

const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN_WIDTH = 150;
const ROW_HEIGHT = 32;

export function DataGrid({
    columns,
    rows,
    selectedRows,
    onRowSelect,
    onRowsSelect,
    onSelectAll,
    sort,
    onSortChange,
    onFilterAdd,
    onCellEdit,
    onBatchCellEdit,
    onRowAction,
    tableName
}: Props) {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const editInputRef = useRef<HTMLInputElement>(null);

    const lastClickedRowRef = useRef<number | null>(null);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const allSelected = rows.length > 0 && selectedRows.size === rows.length;
    const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length;

    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

    useEffect(function () {
        function shouldIgnoreShortcut(target: HTMLElement, e: KeyboardEvent): boolean {
            const tagName = target.tagName;
            if (
                tagName === "INPUT" ||
                tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return true;
            }

            const isMonacoEditor = target.closest(".monaco-editor");
            if (isMonacoEditor) return true;

            const isInNoShortcutsZone = target.closest("[data-no-shortcuts]");
            if (isInNoShortcutsZone) return true;

            return false;
        }


        function handleKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (shouldIgnoreShortcut(target, e)) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                onSelectAll(!allSelected);
            }

            if (e.key === "Escape" && selectedRows.size > 0) {
                onSelectAll(false);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return function () { window.removeEventListener("keydown", handleKeyDown); };
    }, [allSelected, onSelectAll, selectedRows.size]);

    const handleRowClick = useCallback(function (e: React.MouseEvent, rowIndex: number) {
        if (e.button !== 0) return;

        if (e.shiftKey) {
            e.preventDefault();
        }

        if (e.shiftKey && lastClickedRowRef.current !== null && onRowsSelect) {
            const start = Math.min(lastClickedRowRef.current, rowIndex);
            const end = Math.max(lastClickedRowRef.current, rowIndex);
            const range = [];
            for (let i = start; i <= end; i++) {
                range.push(i);
            }
            onRowsSelect(range, true);
        } else if (e.ctrlKey || e.metaKey) {
            onRowSelect(rowIndex, !selectedRows.has(rowIndex));
            lastClickedRowRef.current = rowIndex;
        } else {
            lastClickedRowRef.current = rowIndex;
        }
    }, [selectedRows, onRowSelect, onRowsSelect]);

    function handleSort(columnName: string) {
        if (!onSortChange) return;

        if (sort?.column === columnName) {
            if (sort.direction === "asc") {
                onSortChange({ column: columnName, direction: "desc" });
            } else {
                onSortChange(undefined);
            }
        } else {
            onSortChange({ column: columnName, direction: "asc" });
        }
    }

    function getColumnWidth(colName: string) {
        return columnWidths[colName] || DEFAULT_COLUMN_WIDTH;
    }

    const handleResizeStart = useCallback(function (e: React.MouseEvent, columnName: string) {
        e.preventDefault();
        e.stopPropagation();

        setResizingColumn(columnName);
        startXRef.current = e.clientX;
        startWidthRef.current = getColumnWidth(columnName);
    }, [columnWidths]);

    useEffect(function () {
        if (!resizingColumn) return;

        function handleMouseMove(e: MouseEvent) {
            const delta = e.clientX - startXRef.current;
            const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta);

            setColumnWidths(function (prev) {
                return {
                    ...prev,
                    [resizingColumn!]: newWidth
                };
            });
        }

        function handleMouseUp() {
            setResizingColumn(null);
        }

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return function () {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [resizingColumn]);

    const handleResizeDoubleClick = useCallback(function (e: React.MouseEvent, columnName: string) {
        e.preventDefault();
        e.stopPropagation();

        setColumnWidths(function (prev) {
            const next = { ...prev };
            delete next[columnName];
            return next;
        });
    }, []);

    const handleCellDoubleClick = useCallback(function (rowIndex: number, columnName: string, currentValue: unknown) {
        setEditingCell({ rowIndex, columnName });
        setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
    }, []);

    const handleSaveEdit = useCallback(function () {
        if (editingCell && onCellEdit) {
            onCellEdit(editingCell.rowIndex, editingCell.columnName, editValue);
        }
        setEditingCell(null);
        setEditValue("");
    }, [editingCell, editValue, onCellEdit]);

    const handleCancelEdit = useCallback(function () {
        setEditingCell(null);
        setEditValue("");
    }, []);

    const handleEditKeyDown = useCallback(function (e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelEdit();
        }
    }, [handleSaveEdit, handleCancelEdit]);

    useEffect(function () {
        if (editingCell && editInputRef.current) {
            const timer = setTimeout(function () {
                if (editInputRef.current) {
                    editInputRef.current.focus();
                    editInputRef.current.select();
                }
            }, 10);
            return function () { clearTimeout(timer); };
        }
    }, [editingCell]);

    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-foreground text-sm">
                No columns found for this table
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <table
                className="min-w-full text-sm border-collapse select-none"
                style={{ tableLayout: "fixed" }}
                role="grid"
                aria-label={tableName ? `Data grid for ${tableName}` : "Data grid"}
                aria-rowcount={rows.length}
                aria-colcount={columns.length + 1}
            >
                <colgroup>
                    <col style={{ width: 30 }} />
                    {columns.map(function (col) {
                        return (
                            <col
                                key={col.name}
                                style={{ width: getColumnWidth(col.name) }}
                            />
                        );
                    })}
                </colgroup>
                <thead className="sticky top-0 bg-sidebar z-10" role="rowgroup">
                    <tr role="row" style={{ height: ROW_HEIGHT }}>
                        <th
                            className="w-[30px] px-1 text-center border-b border-r border-sidebar-border bg-sidebar-accent/50"
                            style={{ height: ROW_HEIGHT }}
                            role="columnheader"
                            aria-label="Select all rows"
                        >
                            <Checkbox
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={function (checked) { onSelectAll(!!checked); }}
                                className="h-4 w-4"
                                aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
                            />
                        </th>
                        {columns.map(function (col) {
                            const isSorted = sort?.column === col.name;
                            const width = getColumnWidth(col.name);

                            return (
                                <th
                                    key={col.name}
                                    className={cn(
                                        "text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 cursor-pointer transition-colors hover:bg-sidebar-accent relative select-none",
                                        isSorted && "bg-sidebar-accent",
                                        resizingColumn === col.name && "bg-sidebar-accent"
                                    )}
                                    style={{ width, height: ROW_HEIGHT }}
                                    onClick={function () { handleSort(col.name); }}
                                >
                                    <div className="flex items-center gap-1.5 justify-between group px-3 overflow-hidden h-full">
                                        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                            <span className="text-foreground text-xs font-semibold truncate">{col.name}</span>
                                            <span className="text-muted-foreground/50 text-[10px] font-normal font-mono lowercase shrink-0">
                                                {col.type}
                                            </span>
                                        </div>
                                        {isSorted && sort ? (
                                            sort.direction === "asc" ? (
                                                <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                                            ) : (
                                                <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                                        )}
                                    </div>

                                    <div
                                        className={cn(
                                            "absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors",
                                            resizingColumn === col.name && "bg-primary"
                                        )}
                                        onMouseDown={function (e) { handleResizeStart(e, col.name); }}
                                        onDoubleClick={function (e) { handleResizeDoubleClick(e, col.name); }}
                                        onClick={function (e) { e.stopPropagation(); }}
                                    />
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody role="rowgroup">
                    {rows.map(function (row, rowIndex) {
                        return (
                            <RowContextMenu
                                key={rowIndex}
                                row={row}
                                rowIndex={rowIndex}
                                columns={columns}
                                tableName={tableName}
                                onAction={onRowAction}
                            >
                                <tr
                                    className={cn(
                                        "transition-colors duration-75 cursor-pointer",
                                        selectedRows.has(rowIndex)
                                            ? "bg-[hsl(var(--cell-selection-bg)/0.08)]"
                                            : rowIndex % 2 === 1 ? "bg-muted/5 hover:bg-sidebar-accent/30" : "hover:bg-sidebar-accent/30"
                                    )}
                                    style={{ height: ROW_HEIGHT }}
                                    onClick={function (e) { handleRowClick(e, rowIndex); }}
                                    role="row"
                                    aria-rowindex={rowIndex + 2}
                                    aria-selected={selectedRows.has(rowIndex)}
                                    tabIndex={0}
                                    onKeyDown={function (e) {
                                        if (e.key === " " || e.key === "Enter") {
                                            e.preventDefault();
                                            onRowSelect(rowIndex, !selectedRows.has(rowIndex));
                                        }
                                    }}
                                >
                                    <td
                                        className="px-1 text-center border-b border-r border-sidebar-border"
                                        style={{ height: ROW_HEIGHT }}
                                        role="gridcell"
                                    >
                                        <Checkbox
                                            checked={selectedRows.has(rowIndex)}
                                            onCheckedChange={function (checked) { onRowSelect(rowIndex, !!checked); }}
                                            className="h-4 w-4"
                                            aria-label={`Select row ${rowIndex + 1}`}
                                        />
                                    </td>
                                    {columns.map(function (col, colIndex) {
                                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnName === col.name;
                                        const isFocused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;

                                        return (
                                            <CellContextMenu
                                                key={col.name}
                                                value={row[col.name]}
                                                column={col}
                                                rowIndex={rowIndex}
                                                selectedRows={selectedRows}
                                                onAction={function (action, value, column, batchAction) {
                                                    if (action === "filter-by-value" && onFilterAdd) {
                                                        onFilterAdd({
                                                            column: column.name,
                                                            operator: "eq",
                                                            value: value
                                                        });
                                                    } else if (action === "edit") {
                                                        handleCellDoubleClick(rowIndex, column.name, value);
                                                    } else if (action === "set-null" && onCellEdit) {
                                                        onCellEdit(rowIndex, column.name, null);
                                                    } else if (action === "set-null-batch" && batchAction && onBatchCellEdit) {
                                                        onBatchCellEdit(batchAction.rowIndexes, column.name, null);
                                                    } else {
                                                        console.log("Cell action:", action, value, column.name);
                                                    }
                                                }}
                                            >
                                                <td
                                                    className={cn(
                                                        "border-b border-r border-sidebar-border last:border-r-0 font-mono text-xs overflow-hidden relative",
                                                        isEditing ? "p-0" : "px-3",
                                                        isFocused && !isEditing && "cell-focused"
                                                    )}
                                                    style={{
                                                        maxWidth: getColumnWidth(col.name),
                                                        height: ROW_HEIGHT,
                                                    }}
                                                    onClick={function (e) {
                                                        e.stopPropagation();
                                                        setFocusedCell({ row: rowIndex, col: colIndex });
                                                    }}
                                                    onDoubleClick={function () { handleCellDoubleClick(rowIndex, col.name, row[col.name]); }}
                                                >
                                                    {isEditing ? (
                                                        <input
                                                            ref={editInputRef}
                                                            type="text"
                                                            value={editValue}
                                                            onChange={function (e) { setEditValue(e.target.value); }}
                                                            onBlur={handleSaveEdit}
                                                            onKeyDown={handleEditKeyDown}
                                                            data-no-shortcuts="true"
                                                            className="w-full px-3 bg-transparent font-mono text-xs text-[hsl(var(--cell-foreground))] outline-none"
                                                            style={{
                                                                height: ROW_HEIGHT - 1,
                                                                boxShadow: "inset 0 0 0 2px hsl(var(--cell-selection-border))"
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="truncate flex items-center h-full">
                                                            {formatCellValue(row[col.name], col)}
                                                        </div>
                                                    )}
                                                </td>
                                            </CellContextMenu>
                                        );
                                    })}
                                </tr>
                            </RowContextMenu>
                        );
                    })}
                </tbody>
            </table>
            <style dangerouslySetInnerHTML={{
                __html: `
                .cell-focused {
                    box-shadow: inset 0 0 0 2px hsl(var(--cell-selection-border));
                    background-color: hsl(var(--cell-selection-bg) / 0.08);
                }
                `
            }} />
        </ScrollArea>
    );
}

function formatCellValue(value: unknown, column: ColumnDefinition): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground/60 italic">NULL</span>;
    }

    if (typeof value === "boolean") {
        return (
            <span className={value ? "text-emerald-400" : "text-rose-400"}>
                {value ? "true" : "false"}
            </span>
        );
    }

    if (typeof value === "number") {
        return <span className="text-sky-400">{value}</span>;
    }

    if (typeof value === "object") {
        return <span className="text-amber-400">{JSON.stringify(value)}</span>;
    }

    return <span className="text-[hsl(var(--cell-foreground))]">{String(value)}</span>;
}
