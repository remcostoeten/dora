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
    // Editing state
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const editInputRef = useRef<HTMLInputElement>(null);

    // Last clicked row for shift+click range selection
    const lastClickedRowRef = useRef<number | null>(null);

    // Track column widths - keyed by column name
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const allSelected = rows.length > 0 && selectedRows.size === rows.length;
    const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length;

    // Focused cell for keyboard navigation
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

    // Global keyboard shortcuts for data grid
    useEffect(() => {
        const shouldIgnoreShortcut = (target: HTMLElement, e: KeyboardEvent): boolean => {
            // Check for editable elements
            const tagName = target.tagName;
            if (
                tagName === "INPUT" ||
                tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return true;
            }

            // Check if target is inside a Monaco editor
            const isMonacoEditor = target.closest(".monaco-editor");
            if (isMonacoEditor) return true;

            // Check if target is inside any element with data-no-shortcuts attribute
            const isInNoShortcutsZone = target.closest("[data-no-shortcuts]");
            if (isInNoShortcutsZone) return true;

            return false;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (shouldIgnoreShortcut(target, e)) return;

            // Ctrl/Cmd + A: Select all rows
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                onSelectAll(!allSelected);
            }

            // Escape: Deselect all rows
            if (e.key === "Escape" && selectedRows.size > 0) {
                onSelectAll(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [allSelected, onSelectAll, selectedRows.size]);

    // Handle row click with Ctrl/Shift modifiers
    const handleRowClick = useCallback((e: React.MouseEvent, rowIndex: number) => {
        // Don't interfere with cell context menu or editing
        if (e.button !== 0) return;

        // Prevent text selection on shift+click
        if (e.shiftKey) {
            e.preventDefault();
        }

        if (e.shiftKey && lastClickedRowRef.current !== null && onRowsSelect) {
            // Shift+click: select range from last clicked to current
            const start = Math.min(lastClickedRowRef.current, rowIndex);
            const end = Math.max(lastClickedRowRef.current, rowIndex);
            const range = [];
            for (let i = start; i <= end; i++) {
                range.push(i);
            }
            onRowsSelect(range, true);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl+click: toggle single row
            onRowSelect(rowIndex, !selectedRows.has(rowIndex));
            lastClickedRowRef.current = rowIndex;
        } else {
            // Regular click: just update last clicked (actual selection via checkbox)
            lastClickedRowRef.current = rowIndex;
        }
    }, [selectedRows, onRowSelect, onRowsSelect]);

    const handleSort = (columnName: string) => {
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
    };

    // Get width for a column, defaulting to DEFAULT_COLUMN_WIDTH
    const getColumnWidth = (colName: string) => {
        return columnWidths[colName] || DEFAULT_COLUMN_WIDTH;
    };

    // Start resizing a column
    const handleResizeStart = useCallback((e: React.MouseEvent, columnName: string) => {
        e.preventDefault();
        e.stopPropagation();

        setResizingColumn(columnName);
        startXRef.current = e.clientX;
        startWidthRef.current = getColumnWidth(columnName);
    }, [columnWidths]);

    // Handle mouse move during resize
    useEffect(() => {
        if (!resizingColumn) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startXRef.current;
            const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta);

            setColumnWidths(prev => ({
                ...prev,
                [resizingColumn]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [resizingColumn]);

    // Double-click to reset column width to auto/default
    const handleResizeDoubleClick = useCallback((e: React.MouseEvent, columnName: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Reset to default width
        setColumnWidths(prev => {
            const next = { ...prev };
            delete next[columnName];
            return next;
        });
    }, []);

    // Start editing a cell
    const handleCellDoubleClick = useCallback((rowIndex: number, columnName: string, currentValue: unknown) => {
        setEditingCell({ rowIndex, columnName });
        setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
    }, []);

    // Save edit and exit edit mode
    const handleSaveEdit = useCallback(() => {
        if (editingCell && onCellEdit) {
            onCellEdit(editingCell.rowIndex, editingCell.columnName, editValue);
        }
        setEditingCell(null);
        setEditValue("");
    }, [editingCell, editValue, onCellEdit]);

    // Cancel edit
    const handleCancelEdit = useCallback(() => {
        setEditingCell(null);
        setEditValue("");
    }, []);

    // Handle key press in edit input
    const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelEdit();
        }
    }, [handleSaveEdit, handleCancelEdit]);

    // Focus input when editing cell changes
    useEffect(() => {
        if (editingCell && editInputRef.current) {
            // Small delay to ensure render is complete and focus works reliably
            const timer = setTimeout(() => {
                if (editInputRef.current) {
                    editInputRef.current.focus();
                    editInputRef.current.select();
                }
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [editingCell]);

    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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
                    {columns.map((col) => (
                        <col
                            key={col.name}
                            style={{ width: getColumnWidth(col.name) }}
                        />
                    ))}
                </colgroup>
                <thead className="sticky top-0 bg-sidebar z-10" role="rowgroup">
                    <tr role="row">
                        {/* Checkbox column */}
                        <th
                            className="w-[30px] px-1 py-2 text-center border-b border-r border-sidebar-border bg-sidebar-accent/50"
                            role="columnheader"
                            aria-label="Select all rows"
                        >
                            <Checkbox
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={(checked) => onSelectAll(!!checked)}
                                className="h-4 w-4"
                                aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
                            />
                        </th>
                        {/* Data columns */}
                        {columns.map((col) => {
                            const isSorted = sort?.column === col.name;
                            const width = getColumnWidth(col.name);

                            return (
                                <th
                                    key={col.name}
                                    className={cn(
                                        "text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 h-9 cursor-pointer transition-colors hover:bg-sidebar-accent relative select-none",
                                        isSorted && "bg-sidebar-accent",
                                        resizingColumn === col.name && "bg-sidebar-accent"
                                    )}
                                    style={{ width }}
                                    onClick={() => handleSort(col.name)}
                                >
                                    <div className="flex items-center gap-1.5 justify-between group px-3 py-2 overflow-hidden">
                                        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                            <span className="text-sidebar-foreground text-xs truncate">{col.name}</span>
                                            <span className="text-muted-foreground/50 text-[10px] font-normal font-mono lowercase shrink-0">
                                                {col.type}
                                            </span>
                                        </div>
                                        {isSorted ? (
                                            sort.direction === "asc" ? (
                                                <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                                            ) : (
                                                <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                                        )}
                                    </div>

                                    {/* Resize handle */}
                                    <div
                                        className={cn(
                                            "absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors",
                                            resizingColumn === col.name && "bg-primary"
                                        )}
                                        onMouseDown={(e) => handleResizeStart(e, col.name)}
                                        onDoubleClick={(e) => handleResizeDoubleClick(e, col.name)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody role="rowgroup">
                    {rows.map((row, rowIndex) => (
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
                                    "transition-colors cursor-pointer",
                                    selectedRows.has(rowIndex)
                                        ? "bg-primary/10"
                                        : rowIndex % 2 === 1 ? "bg-muted/5 hover:bg-sidebar-accent/30" : "hover:bg-sidebar-accent/30"
                                )}
                                onClick={(e) => handleRowClick(e, rowIndex)}
                                role="row"
                                aria-rowindex={rowIndex + 2}
                                aria-selected={selectedRows.has(rowIndex)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === " " || e.key === "Enter") {
                                        e.preventDefault();
                                        onRowSelect(rowIndex, !selectedRows.has(rowIndex));
                                    }
                                }}
                            >
                                <td
                                    className="px-1 py-1.5 text-center border-b border-r border-sidebar-border"
                                    role="gridcell"
                                >
                                    <Checkbox
                                        checked={selectedRows.has(rowIndex)}
                                        onCheckedChange={(checked) => onRowSelect(rowIndex, !!checked)}
                                        className="h-4 w-4"
                                        aria-label={`Select row ${rowIndex + 1}`}
                                    />
                                </td>
                                {columns.map((col, colIndex) => {
                                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnName === col.name;
                                    const isFocused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;

                                    return (
                                        <CellContextMenu
                                            key={col.name}
                                            value={row[col.name]}
                                            column={col}
                                            rowIndex={rowIndex}
                                            selectedRows={selectedRows}
                                            onAction={(action, value, column, batchAction) => {
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
                                                    "border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm overflow-hidden cursor-cell",
                                                    isEditing ? "p-0" : "px-3 py-1.5",
                                                    isFocused && !isEditing && "ring-2 ring-inset ring-primary bg-primary/5"
                                                )}
                                                style={{ maxWidth: getColumnWidth(col.name) }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFocusedCell({ row: rowIndex, col: colIndex });
                                                }}
                                                onDoubleClick={() => handleCellDoubleClick(rowIndex, col.name, row[col.name])}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onBlur={handleSaveEdit}
                                                        onKeyDown={handleEditKeyDown}
                                                        data-no-shortcuts="true"
                                                        className="w-full h-full px-3 py-1.5 bg-primary/10 border-2 border-primary outline-hidden font-mono text-sm"
                                                    />
                                                ) : (
                                                    <div className="truncate">
                                                        {formatCellValue(row[col.name], col)}
                                                    </div>
                                                )}
                                            </td>
                                        </CellContextMenu>
                                    );
                                })}
                            </tr>
                        </RowContextMenu>
                    ))}
                </tbody>
            </table>
        </ScrollArea>
    );
}

function formatCellValue(value: unknown, column: ColumnDefinition): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">NULL</span>;
    }

    if (typeof value === "boolean") {
        return (
            <span className={value ? "text-success" : "text-destructive"}>
                {value ? "true" : "false"}
            </span>
        );
    }

    if (typeof value === "number") {
        return <span className="text-primary">{value}</span>;
    }

    if (typeof value === "object") {
        return <span className="text-warning">{JSON.stringify(value)}</span>;
    }

    return <span className="text-sidebar-foreground">{String(value)}</span>;
}
