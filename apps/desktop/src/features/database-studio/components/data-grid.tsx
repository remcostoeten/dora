import { useState, useRef, useCallback, useEffect } from "react";
import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { ColumnDefinition, SortDescriptor, FilterDescriptor } from "../types";
import { CellContextMenu } from "./cell-context-menu";
import { RowContextMenu, type RowAction } from "./row-context-menu";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useShortcut } from "@/core/shortcuts";

type EditingCell = {
    rowIndex: number;
    columnName: string;
};

type CellPosition = {
    row: number;
    col: number;
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
    selectedCells?: Set<string>;
    onCellSelectionChange?: (cells: Set<string>) => void;
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
    tableName,
    selectedCells: externalSelectedCells,
    onCellSelectionChange
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
    const gridRef = useRef<HTMLTableElement>(null);

    const [internalSelectedCells, setInternalSelectedCells] = useState<Set<string>>(new Set());
    const selectedCellsSet = externalSelectedCells ?? internalSelectedCells;
    const [anchorCell, setAnchorCell] = useState<CellPosition | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<CellPosition | null>(null);

    function updateCellSelection(cells: Set<string>) {
        if (onCellSelectionChange) {
            onCellSelectionChange(cells);
        } else {
            setInternalSelectedCells(cells);
        }
    }

    function getCellKey(row: number, col: number): string {
        return `${row}:${col}`;
    }

    function getCellsInRectangle(start: CellPosition, end: CellPosition): Set<string> {
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);

        const cells = new Set<string>();
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                cells.add(getCellKey(r, c));
            }
        }
        return cells;
    }

    function handleCellMouseDown(e: React.MouseEvent, rowIndex: number, colIndex: number) {
        if (e.button !== 0) return;
        if (editingCell) return;

        e.preventDefault();

        const cellPos: CellPosition = { row: rowIndex, col: colIndex };

        if (e.shiftKey && anchorCell) {
            const rangeCells = getCellsInRectangle(anchorCell, cellPos);
            if (e.ctrlKey || e.metaKey) {
                const newSelection = new Set(selectedCellsSet);
                rangeCells.forEach(function(key) { newSelection.add(key); });
                updateCellSelection(newSelection);
            } else {
                updateCellSelection(rangeCells);
            }
        } else if (e.ctrlKey || e.metaKey) {
            const key = getCellKey(rowIndex, colIndex);
            const newSelection = new Set(selectedCellsSet);
            if (newSelection.has(key)) {
                newSelection.delete(key);
            } else {
                newSelection.add(key);
            }
            updateCellSelection(newSelection);
            setAnchorCell(cellPos);
        } else {
            updateCellSelection(new Set([getCellKey(rowIndex, colIndex)]));
            setAnchorCell(cellPos);
            setDragStart(cellPos);
            setIsDragging(true);
        }

        setFocusedCell(cellPos);
    }

    function handleCellMouseEnter(rowIndex: number, colIndex: number) {
        if (!isDragging || !dragStart) return;

        const cellPos: CellPosition = { row: rowIndex, col: colIndex };
        const rangeCells = getCellsInRectangle(dragStart, cellPos);
        updateCellSelection(rangeCells);
    }

    useEffect(function() {
        if (!isDragging) return;

        function handleMouseUp() {
            setIsDragging(false);
            setDragStart(null);
        }

        document.addEventListener("mouseup", handleMouseUp);
        return function() {
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    const $ = useShortcut();

    $.mod.key("a").except("typing").on(function() {
        onSelectAll(!allSelected);
    }, { description: "Select all rows" });

    $.key("escape").except("typing").on(function() {
        if (selectedRows.size > 0) {
            onSelectAll(false);
        }
    }, { description: "Deselect all rows" });

    $.mod.key("d").except("typing").on(function() {
        onSelectAll(false);
    }, { description: "Deselect all rows" });

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

    // Get width for a column, defaulting to undefined (fluid)
    function getColumnWidth(colName: string) {
        return columnWidths[colName];
    }

    // Start resizing a column
    const handleResizeStart = useCallback(function(e: React.MouseEvent, columnName: string) {
        e.preventDefault();
        e.stopPropagation();

        setResizingColumn(columnName);
        startXRef.current = e.clientX;
        
        const currentWidth = columnWidths[columnName];
        if (typeof currentWidth === "number") {
             startWidthRef.current = currentWidth;
        } else {
             const th = (e.target as HTMLElement).closest("th");
             startWidthRef.current = th?.getBoundingClientRect().width ?? DEFAULT_COLUMN_WIDTH;
        }
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

    const handleGridKeyDown = useCallback(function (e: React.KeyboardEvent) {
        if (!focusedCell) return;
        if (editingCell) return;

        const { row, col } = focusedCell;
        const maxRow = rows.length - 1;
        const maxCol = columns.length - 1;

        function moveAndMaybeSelect(newRow: number, newCol: number) {
            const newPos: CellPosition = { row: newRow, col: newCol };
            setFocusedCell(newPos);

            if (e.shiftKey && anchorCell) {
                const rangeCells = getCellsInRectangle(anchorCell, newPos);
                updateCellSelection(rangeCells);
            } else if (!e.shiftKey) {
                setAnchorCell(newPos);
                updateCellSelection(new Set([getCellKey(newRow, newCol)]));
            }
        }

        switch (e.key) {
            case "ArrowUp":
                e.preventDefault();
                if (row > 0) moveAndMaybeSelect(row - 1, col);
                break;
            case "ArrowDown":
                e.preventDefault();
                if (row < maxRow) moveAndMaybeSelect(row + 1, col);
                break;
            case "ArrowLeft":
                e.preventDefault();
                if (col > 0) moveAndMaybeSelect(row, col - 1);
                break;
            case "ArrowRight":
                e.preventDefault();
                if (col < maxCol) moveAndMaybeSelect(row, col + 1);
                break;
            case "Tab":
                e.preventDefault();
                if (e.shiftKey) {
                    if (col > 0) {
                        setFocusedCell({ row, col: col - 1 });
                    } else if (row > 0) {
                        setFocusedCell({ row: row - 1, col: maxCol });
                    }
                } else {
                    if (col < maxCol) {
                        setFocusedCell({ row, col: col + 1 });
                    } else if (row < maxRow) {
                        setFocusedCell({ row: row + 1, col: 0 });
                    }
                }
                break;
            case "Enter":
                e.preventDefault();
                handleCellDoubleClick(row, columns[col].name, rows[row][columns[col].name]);
                break;
            case "Escape":
                e.preventDefault();
                setFocusedCell(null);
                updateCellSelection(new Set());
                break;
            case " ":
                e.preventDefault();
                onRowSelect(row, !selectedRows.has(row));
                break;
        }
    }, [focusedCell, editingCell, rows, columns, handleCellDoubleClick, onRowSelect, selectedRows, anchorCell, selectedCellsSet]);

    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-foreground text-sm">
                No columns found for this table
            </div>
        );
    }

    return (
        <ScrollArea className="h-full w-full" type="always">
            <table
                ref={gridRef}
                className="w-full text-sm border-collapse select-none"
                style={{ tableLayout: "fixed" }}
                role="grid"
                aria-label={tableName ? `Data grid for ${tableName}` : "Data grid"}
                aria-rowcount={rows.length}
                aria-colcount={columns.length + 1}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
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
                                        "text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 h-9 cursor-pointer transition-colors hover:bg-sidebar-accent relative select-none min-w-[60px]",
                                        isSorted && "bg-sidebar-accent",
                                        resizingColumn === col.name && "bg-sidebar-accent"
                                    )}
                                    style={width ? { width } : undefined}
                                    onClick={() => handleSort(col.name)}
                                >
                                    <div className="flex items-center gap-1.5 justify-between group px-3 py-2 overflow-hidden">
                                        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                                            <span className="text-foreground text-xs truncate">{col.name}</span>
                                            {col.type && col.type !== "unknown" && (
                                                <span className="text-muted-foreground/50 text-[10px] font-normal font-mono lowercase shrink-0">
                                                    {col.type}
                                                </span>
                                            )}
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
                                    const isSelected = selectedCellsSet.has(getCellKey(rowIndex, colIndex));
                                    const width = getColumnWidth(col.name);

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
                                                    "border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm overflow-hidden cursor-cell px-3 py-1.5",
                                                    isSelected && !isEditing && "bg-primary/20",
                                                    isFocused && !isEditing && "outline outline-1 outline-offset-[-1px] outline-primary/60 bg-primary/5"
                                                )}
                                                style={width ? { maxWidth: width } : undefined}
                                                onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                                onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
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
                                                        className="w-full h-full bg-primary/10 outline outline-1 outline-offset-[-1px] outline-primary font-mono text-sm -mx-3 -my-1.5 px-3 py-1.5 box-content"
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

    return <span className="text-foreground">{String(value)}</span>;
}
