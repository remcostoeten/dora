import { useState, useEffect, useCallback, useRef } from "react";
import { Database, Plus, PanelLeft, Trash2, Columns } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { StudioToolbar } from "./components/studio-toolbar";
import { DataGrid } from "./components/data-grid";
import { BottomStatusBar } from "./components/bottom-status-bar";
import { SelectionActionBar } from "./components/selection-action-bar";
import { AddRecordDialog } from "./components/add-record-dialog";
import { AddColumnDialog, ColumnFormData } from "./components/add-column-dialog";
import { DropTableDialog } from "./components/drop-table-dialog";
import { PendingChangesBar } from "./components/pending-changes-bar";
import { RowDetailPanel } from "./components/row-detail-panel";
import { BulkEditDialog } from "./components/bulk-edit-dialog";
import { SetNullDialog } from "./components/set-null-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAdapter, useDataMutation } from "@/core/data-provider";
import { useSettings } from "@/core/settings";
import { usePendingEdits } from "@/core/pending-edits";
import { useUndo } from "@/core/undo";
import { useUrlState, ContextMenuState } from "@/core/url-state";
import { commands } from "@/lib/bindings";
import {
    TableData,
    PaginationState,
    ViewMode,
    ColumnDefinition,
    SortDescriptor,
    FilterDescriptor
} from "./types";

type Props = {
    tableId: string | null;
    tableName: string | null;
    onToggleSidebar?: () => void;
    activeConnectionId?: string;
    onAddConnection?: () => void;
};

export function DatabaseStudio({ tableId, tableName, onToggleSidebar, activeConnectionId, onAddConnection }: Props) {
    const adapter = useAdapter();
    const { updateCell, deleteRows, insertRow } = useDataMutation();
    const { settings } = useSettings();
    const { isDryEditMode, setDryEditMode, addEdit, removeEdit, pendingEdits, getEditsForTable, getEditCount, clearEdits, hasEdits } = usePendingEdits();
    const [isApplyingEdits, setIsApplyingEdits] = useState(false);
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [addDialogMode, setAddDialogMode] = useState<"add" | "duplicate">("add");
    const [duplicateInitialData, setDuplicateInitialData] = useState<Record<string, unknown> | undefined>(undefined);
    const [showRowDetail, setShowRowDetail] = useState(false);
    const [selectedRowForDetail, setSelectedRowForDetail] = useState<Record<string, unknown> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("content");
    const [pagination, setPagination] = useState<PaginationState>({ limit: 50, offset: 0 });
    const [sort, setSort] = useState<SortDescriptor | undefined>();
    const [filters, setFilters] = useState<FilterDescriptor[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
    const [showDropTableDialog, setShowDropTableDialog] = useState(false);
    const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
    const [showSetNullDialog, setShowSetNullDialog] = useState(false);
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
    const [isDdlLoading, setIsDdlLoading] = useState(false);

    const [draftRow, setDraftRow] = useState<Record<string, unknown> | null>(null);
    const [draftInsertIndex, setDraftInsertIndex] = useState<number | null>(null);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());

    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState>(null);

    const { urlState, setSelectedRow, setSelectedCells: setUrlSelectedCells, setFocusedCell: setUrlFocusedCell, setContextMenu, setAddRecordMode } = useUrlState();
    const initializedFromUrlRef = useRef(false);

    // Delay showing skeleton to avoid flash for fast queries
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isLoading && !tableData) {
            timer = setTimeout(() => setShowSkeleton(true), 150);
        } else {
            setShowSkeleton(false);
        }
        return () => clearTimeout(timer);
    }, [isLoading, tableData]);

    const loadTableData = useCallback(async () => {
        console.log("[DatabaseStudio] loadTableData called", { tableId, activeConnectionId });

        if (!tableId || !activeConnectionId) {
            console.log("[DatabaseStudio] Skipping load - missing tableId or activeConnectionId");
            return;
        }

        setIsLoading(true);
        setSelectedRows(new Set());

        try {
            console.log("[DatabaseStudio] Fetching data for table:", tableName || tableId);
            const result = await adapter.fetchTableData(
                activeConnectionId,
                tableName || tableId,
                Math.floor(pagination.offset / pagination.limit),
                pagination.limit,
                sort,
                filters
            );

            if (result.ok) {
                const data = result.data;
                console.log("[DatabaseStudio] Data received:", { columns: data.columns.length, rows: data.rows.length });
                setTableData(data);

                // If it's a new table or first load, reset visible columns to show all
                if (data.columns.length > 0) {
                    setVisibleColumns(prev => {
                        if (prev.size === 0) {
                            return new Set(data.columns.map(c => c.name));
                        }
                        return prev;
                    });
                }
            } else {
                console.error("[DatabaseStudio] Failed to load table data:", result.error);
                setTableData(null);
            }
        } catch (error) {
            console.error("[DatabaseStudio] Unexpected error loading table data:", error);
            setTableData(null);
        } finally {
            setIsLoading(false);
        }
    }, [adapter, tableId, tableName, activeConnectionId, pagination.limit, pagination.offset, sort, filters]);

    useEffect(function () {
        loadTableData();
    }, [loadTableData]);

    const { trackCellMutation, trackBatchCellMutation } = useUndo({ onUndoComplete: loadTableData });

    // Reset state when table changes
    useEffect(() => {
        setPagination({ limit: 50, offset: 0 });
        setSort(undefined);
        setFilters([]);
        setVisibleColumns(new Set());
        initializedFromUrlRef.current = false;
    }, [tableId]);

    useEffect(function initializeFromUrl() {
        if (initializedFromUrlRef.current || !tableData) return;
        initializedFromUrlRef.current = true;

        if (urlState.selectedRow !== null) {
            if (urlState.selectedRow >= 0 && urlState.selectedRow < tableData.rows.length) {
                setSelectedRows(new Set([urlState.selectedRow]));
            }
        }
        if (urlState.selectedCells.size > 0) {
            const validCells = new Set<string>();
            for (const cellKey of urlState.selectedCells) {
                const parts = cellKey.split(':');
                if (parts.length === 2) {
                    const r = parseInt(parts[0], 10);
                    const c = parseInt(parts[1], 10);
                    if (
                        !isNaN(r) && !isNaN(c) &&
                        r >= 0 && r < tableData.rows.length &&
                        c >= 0 && c < tableData.columns.length
                    ) {
                        validCells.add(cellKey);
                    }
                }
            }
            if (validCells.size > 0) {
                setSelectedCells(validCells);
            }
        }
        if (urlState.focusedCell) {
            const { row, col } = urlState.focusedCell;
            if (
                row >= 0 && row < tableData.rows.length &&
                col >= 0 && col < tableData.columns.length
            ) {
                setFocusedCell(urlState.focusedCell);
            }
        }
        if (urlState.contextMenu) {
            const { cell } = urlState.contextMenu;
            if (cell.row >= 0 && cell.row < tableData.rows.length) {
                setContextMenuState(urlState.contextMenu);
            }
        }
        if (urlState.addRecordMode && tableData) {
            if (
                urlState.addRecordIndex === null ||
                (urlState.addRecordIndex >= -1 && urlState.addRecordIndex <= tableData.rows.length)
            ) {
                const defaults = createDefaultValues(tableData.columns);
                setDraftRow(defaults);
                setDraftInsertIndex(urlState.addRecordIndex ?? -1);
            }
        }
    }, [tableData, urlState]);

    useEffect(function syncSelectedRowToUrl() {
        if (!initializedFromUrlRef.current) return;
        const firstSelected = selectedRows.size > 0 ? Array.from(selectedRows)[0] : null;
        setSelectedRow(firstSelected);
    }, [selectedRows, setSelectedRow]);

    useEffect(function syncCellsToUrl() {
        if (!initializedFromUrlRef.current) return;
        setUrlSelectedCells(selectedCells);
    }, [selectedCells, setUrlSelectedCells]);

    useEffect(function syncFocusedCellToUrl() {
        if (!initializedFromUrlRef.current) return;
        setUrlFocusedCell(focusedCell);
    }, [focusedCell, setUrlFocusedCell]);

    useEffect(function syncContextMenuToUrl() {
        if (!initializedFromUrlRef.current) return;
        setContextMenu(contextMenuState);
    }, [contextMenuState, setContextMenu]);

    useEffect(function syncAddRecordToUrl() {
        if (!initializedFromUrlRef.current) return;
        const isAddRecordActive = draftRow !== null;
        setAddRecordMode(isAddRecordActive, draftInsertIndex);
    }, [draftRow, draftInsertIndex, setAddRecordMode]);

    // Define all callbacks before any conditional returns
    const handleBulkDelete = useCallback(() => {
        const primaryKeyColumn = tableData?.columns.find(c => c.primaryKey);
        if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return;

        if (settings.confirmBeforeDelete && !confirm(`Delete ${selectedRows.size} selected rows?`)) return;

        const primaryKeyValues = Array.from(selectedRows).map(function (rowIndex) {
            return tableData.rows[rowIndex][primaryKeyColumn.name];
        });

        deleteRows.mutate({
            connectionId: activeConnectionId,
            tableName: tableName || tableId,
            primaryKeyColumn: primaryKeyColumn.name,
            primaryKeyValues
        }, {
            onSuccess: function () {
                setSelectedRows(new Set());
                loadTableData();
            }
        });
    }, [tableData, activeConnectionId, tableId, tableName, selectedRows, settings.confirmBeforeDelete, deleteRows, loadTableData]);

    const handleBulkCopy = useCallback(() => {
        if (!tableData) return;
        const rowsData = Array.from(selectedRows).map(function (rowIndex) {
            return tableData.rows[rowIndex];
        });
        navigator.clipboard.writeText(JSON.stringify(rowsData, null, 2));
    }, [tableData, selectedRows]);

    const handleBulkDuplicate = useCallback(() => {
        const primaryKeyColumn = tableData?.columns.find(c => c.primaryKey);
        if (!activeConnectionId || !tableId || !tableData) return;

        const rowsToDuplicate = Array.from(selectedRows).map(function (rowIndex) {
            const row = { ...tableData.rows[rowIndex] };
            if (primaryKeyColumn) {
                delete row[primaryKeyColumn.name];
            }
            return row;
        });

        setIsBulkActionLoading(true);
        Promise.all(rowsToDuplicate.map(function (rowData) {
            return insertRow.mutateAsync({
                connectionId: activeConnectionId,
                tableName: tableName || tableId,
                rowData
            });
        })).then(function () {
            setSelectedRows(new Set());
            loadTableData();
        }).catch(function (error) {
            console.error("Failed to duplicate rows:", error);
        }).finally(function () {
            setIsBulkActionLoading(false);
        });
    }, [tableData, activeConnectionId, tableId, tableName, selectedRows, insertRow, loadTableData]);

    const handleExportJson = useCallback(() => {
        if (!tableData) return;
        const rowsData = Array.from(selectedRows).map(function (rowIndex) {
            return tableData.rows[rowIndex];
        });
        const jsonString = JSON.stringify(rowsData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tableName || "data"}_selected.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [tableData, selectedRows, tableName]);

    const handleExportCsv = useCallback(() => {
        if (!tableData) return;
        const rowsData = Array.from(selectedRows).map(function (rowIndex) {
            return tableData.rows[rowIndex];
        });

        if (rowsData.length === 0) return;

        const headers = Object.keys(rowsData[0]);
        const csvRows = [
            headers.join(","),
            ...rowsData.map(function (row) {
                return headers.map(function (header) {
                    const value = row[header];
                    if (value === null || value === undefined) return "";
                    const stringValue = String(value);
                    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(",");
            })
        ];

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tableName || "data"}_selected.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [tableData, selectedRows, tableName]);

    const handleClearSelection = useCallback(() => setSelectedRows(new Set()), []);
    const handleOpenSetNull = useCallback(() => setShowSetNullDialog(true), []);
    const handleOpenBulkEdit = useCallback(() => setShowBulkEditDialog(true), []);

    const handleToggleColumn = (columnName: string, visible: boolean) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (visible) {
                next.add(columnName);
            } else {
                next.delete(columnName);
            }
            return next;
        });
    };

    const handleRowSelect = (rowIndex: number, checked: boolean) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(rowIndex);
            } else {
                next.delete(rowIndex);
            }
            return next;
        });
    };

    const handleRowsSelect = (rowIndices: number[], checked: boolean) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (checked) {
                rowIndices.forEach(i => next.add(i));
            } else {
                rowIndices.forEach(i => next.delete(i));
            }
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked && tableData) {
            setSelectedRows(new Set(tableData.rows.map((_, i) => i)));
        } else {
            setSelectedRows(new Set());
        }
    };

    function handleCellEdit(rowIndex: number, columnName: string, newValue: unknown) {
        if (!tableId || !activeConnectionId || !tableData) return;

        const row = tableData.rows[rowIndex];
        const primaryKeyColumn = tableData.columns.find(function (c) { return c.primaryKey; });
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        if (isDryEditMode) {
            // Check if there's already a pending edit to preserve the ORIGINAL value
            const key = `${tableId}:${String(row[primaryKeyColumn.name])}:${columnName}`;
            const existingEdit = pendingEdits.get(key);
            const oldValue = existingEdit ? existingEdit.oldValue : row[columnName];

            addEdit(tableId, {
                rowIndex,
                primaryKeyColumn: primaryKeyColumn.name,
                primaryKeyValue: row[primaryKeyColumn.name],
                columnName,
                oldValue,
                newValue
            });

            setTableData(function (prev) {
                if (!prev) return prev;
                const newRows = [...prev.rows];
                newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: newValue };
                return { ...prev, rows: newRows };
            });
        } else {
            const previousValue = row[columnName];
            updateCell.mutate({
                connectionId: activeConnectionId,
                tableName: tableName || tableId,
                primaryKeyColumn: primaryKeyColumn.name,
                primaryKeyValue: row[primaryKeyColumn.name],
                columnName,
                newValue
            }, {
                onSuccess: function () {
                    trackCellMutation(
                        activeConnectionId,
                        tableName || tableId,
                        primaryKeyColumn.name,
                        row[primaryKeyColumn.name],
                        columnName,
                        previousValue,
                        newValue
                    );
                    loadTableData();
                },
                onError: function (error) {
                    console.error("Failed to update cell:", error);
                }
            });
        }
    }

    // Handle Undo for Pending Edits (Ctrl+Z)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                if (isDryEditMode && tableId && hasEdits(tableId)) {
                    // Check if we are inside an input (default undo) vs grid navigation
                    // If target is body or grid container, we perform our undo.
                    const target = e.target as HTMLElement;
                    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

                    if (!isInput) {
                        e.preventDefault();
                        e.stopPropagation();

                        const edits = getEditsForTable(tableId);
                        const lastEdit = edits[edits.length - 1];

                        if (lastEdit) {
                            const key = `${tableId}:${String(lastEdit.primaryKeyValue)}:${lastEdit.columnName}`;
                            removeEdit(tableId, key);

                            setTableData(prev => {
                                if (!prev) return prev;
                                const newRows = [...prev.rows];
                                // We trust rowIndex from the edit, assuming table hasn't been re-sorted/filtered in a way that invalidates indices.
                                // Ideal: find row by PK. But for now using index as stored.
                                if (newRows[lastEdit.rowIndex]) {
                                    newRows[lastEdit.rowIndex] = {
                                        ...newRows[lastEdit.rowIndex],
                                        [lastEdit.columnName]: lastEdit.oldValue
                                    };
                                }
                                return { ...prev, rows: newRows };
                            });
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isDryEditMode, tableId, hasEdits, getEditsForTable, removeEdit]);

    async function handleApplyPendingEdits() {
        if (!activeConnectionId || !tableId) return;

        const edits = getEditsForTable(tableId);
        if (edits.length === 0) return;

        setIsApplyingEdits(true);
        try {
            for (const edit of edits) {
                await updateCell.mutateAsync({
                    connectionId: activeConnectionId,
                    tableName: tableName || tableId,
                    primaryKeyColumn: edit.primaryKeyColumn,
                    primaryKeyValue: edit.primaryKeyValue,
                    columnName: edit.columnName,
                    newValue: edit.newValue,
                });
            }
            clearEdits(tableId);
            loadTableData();
        } catch (error) {
            console.error("Failed to apply edits:", error);
        } finally {
            setIsApplyingEdits(false);
        }
    }

    function handleDiscardPendingEdits() {
        if (!tableId) return;
        clearEdits(tableId);
        loadTableData();
    }

    async function handleBatchCellEdit(rowIndexes: number[], columnName: string, newValue: unknown) {
        if (!tableId || !activeConnectionId || !tableData) return;

        const primaryKeyColumn = tableData.columns.find(function (c) { return c.primaryKey; });
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        const cellsToTrack = rowIndexes.map(function (rowIndex) {
            const row = tableData.rows[rowIndex];
            return {
                primaryKeyValue: row[primaryKeyColumn.name],
                columnName,
                previousValue: row[columnName],
                newValue,
            };
        });

        try {
            await Promise.all(rowIndexes.map(async function (rowIndex) {
                const row = tableData.rows[rowIndex];
                return updateCell.mutateAsync({
                    connectionId: activeConnectionId,
                    tableName: tableName || tableId,
                    primaryKeyColumn: primaryKeyColumn.name,
                    primaryKeyValue: row[primaryKeyColumn.name],
                    columnName,
                    newValue
                });
            }));

            trackBatchCellMutation(
                activeConnectionId,
                tableName || tableId,
                primaryKeyColumn.name,
                cellsToTrack
            );

            loadTableData();
        } catch (error) {
            console.error("Failed to batch update cells:", error);
        }
    }

    const handleRowAction = async (action: string, row: Record<string, unknown>, rowIndex: number) => {
        if (!tableId || !activeConnectionId || !tableData) return;

        const primaryKeyColumn = tableData.columns.find(c => c.primaryKey);
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        switch (action) {
            case "delete":
                if (settings.confirmBeforeDelete && !confirm("Are you sure you want to delete this row?")) return;

                deleteRows.mutate({
                    connectionId: activeConnectionId,
                    tableName: tableName || tableId,
                    primaryKeyColumn: primaryKeyColumn.name,
                    primaryKeyValues: [row[primaryKeyColumn.name]]
                }, {
                    onSuccess: () => {
                        loadTableData();
                    },
                    onError: (error) => {
                        console.error("Failed to delete row:", error);
                    }
                });
                break;
            case "view":
                setSelectedRowForDetail(row);
                setShowRowDetail(true);
                break;
            case "edit":
                setDuplicateInitialData(row);
                setAddDialogMode("add");
                setShowAddDialog(true);
                break;
            case "duplicate":
                const duplicateData = { ...row };
                if (primaryKeyColumn) {
                    delete duplicateData[primaryKeyColumn.name];
                }
                // Prefill any missing required timestamp fields if not present in source
                const defaults = createDefaultValues(tableData.columns);
                setDraftRow({ ...defaults, ...duplicateData });
                setDraftInsertIndex(rowIndex + 1);

                // Focus will be handled by the DataGrid effect for new draft row
                break;
            default:
                console.log("Row action:", action, row);
        }
    };

    function createDefaultValues(columns: ColumnDefinition[]): Record<string, unknown> {
        const defaults: Record<string, unknown> = {};
        const now = new Date().toISOString();

        for (const col of columns) {
            if (col.primaryKey) continue;

            const type = col.type.toLowerCase();
            const name = col.name.toLowerCase();
            if (type.includes('timestamp') || type.includes('datetime') || type.includes('date')) {
                defaults[col.name] = now;
            } else if (name.includes('created') || name.includes('updated') || name === 'date') {
                defaults[col.name] = now;
            } else {
                defaults[col.name] = col.nullable ? null : '';
            }
        }
        return defaults;
    }

    function handleAddRecord() {
        if (!tableData) return;
        const defaults = createDefaultValues(tableData.columns);
        setDraftRow(defaults);
        setDraftInsertIndex(-1); // -1 indicates top of the table
    }

    function handleDraftChange(columnName: string, value: unknown) {
        setDraftRow(function (prev) {
            if (!prev) return prev;
            return { ...prev, [columnName]: value };
        });
    }

    function handleDraftSave() {
        if (!activeConnectionId || !tableId || !draftRow) return;

        insertRow.mutate({
            connectionId: activeConnectionId,
            tableName: tableName || tableId,
            rowData: draftRow
        }, {
            onSuccess: function onInsertSuccess() {
                setDraftRow(null);
                setDraftInsertIndex(null);
                loadTableData();
            },
            onError: function onInsertError(error) {
                console.error("Failed to insert row:", error);
            }
        });
    }

    function handleDraftCancel() {
        setDraftRow(null);
        setDraftInsertIndex(null);
    }

    function handleAddRecordSubmit(rowData: Record<string, unknown>) {
        if (!activeConnectionId || !tableId) return;

        insertRow.mutate({
            connectionId: activeConnectionId,
            tableName: tableName || tableId,
            rowData
        }, {
            onSuccess: function onInsertSuccess() {
                setShowAddDialog(false);
                loadTableData();
            },
            onError: function onInsertError(error) {
                console.error("Failed to insert row:", error);
            }
        });
    }

    const handleExport = () => {
        if (!tableData || tableData.rows.length === 0) return;

        const jsonString = JSON.stringify(tableData.rows, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tableName || "data"}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    async function handleAddColumn(columnDef: ColumnFormData) {
        if (!activeConnectionId || !tableName) return;

        setIsDdlLoading(true);
        try {
            let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnDef.name}" ${columnDef.type}`;
            if (!columnDef.nullable) {
                sql += " NOT NULL";
            }
            if (columnDef.defaultValue.trim()) {
                sql += ` DEFAULT ${columnDef.defaultValue}`;
            }

            const result = await commands.executeBatch(activeConnectionId, [sql]);
            if (result.status === "ok") {
                setShowAddColumnDialog(false);
                loadTableData();
            } else {
                console.error("Failed to add column:", result.error);
            }
        } catch (error) {
            console.error("Failed to add column:", error);
        } finally {
            setIsDdlLoading(false);
        }
    }

    async function handleDropTable() {
        if (!activeConnectionId || !tableName) return;

        setIsDdlLoading(true);
        try {
            const sql = `DROP TABLE IF EXISTS "${tableName}"`;
            const result = await commands.executeBatch(activeConnectionId, [sql]);
            if (result.status === "ok") {
                setShowDropTableDialog(false);
            } else {
                console.error("Failed to drop table:", result.error);
            }
        } catch (error) {
            console.error("Failed to drop table:", error);
        } finally {
            setIsDdlLoading(false);
        }
    }

    // No connection selected
    if (!activeConnectionId) {
        return (
            <div className="flex flex-col h-full bg-background/50">
                {onToggleSidebar && (
                    <div className="flex items-center h-10 border-b border-sidebar-border bg-sidebar/50 shrink-0 px-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={onToggleSidebar}
                            title="Toggle sidebar"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                        <span className="ml-3 text-xs font-medium text-muted-foreground/70 tracking-wide uppercase">Database Studio</span>
                    </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-sidebar-accent/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/50 shadow-sm backdrop-blur-sm">
                        <Database className="w-10 h-10 text-primary/60" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-xl font-semibold mb-2 text-foreground tracking-tight">No Database Connected</h2>
                    <p className="text-muted-foreground text-center max-w-sm mb-8 leading-relaxed text-sm">
                        Select a connection from the sidebar to view its tables, or create a new connection to get started.
                    </p>

                    {onAddConnection && (
                        <Button onClick={onAddConnection} className="gap-2 shadow-md hover:shadow-lg transition-all">
                            <Plus className="w-4 h-4" />
                            Add Connection
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // No table selected
    if (!tableId) {
        return (
            <div className="flex flex-col h-full bg-background/50">
                {onToggleSidebar && (
                    <div className="flex items-center h-10 border-b border-sidebar-border bg-sidebar/50 shrink-0 px-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={onToggleSidebar}
                            title="Toggle sidebar"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                        <span className="ml-3 text-xs font-medium text-muted-foreground/70 tracking-wide uppercase">Database Studio</span>
                    </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-sidebar-accent/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/30">
                        <svg className="h-10 w-10 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
                        No Table Selected
                    </h1>
                    <p className="text-muted-foreground text-sm max-w-xs">
                        Select a table from the sidebar list to browse its records, structure, and relationships.
                    </p>
                </div>
            </div>
        );
    }

    // Structure view
    if (viewMode === "structure" && tableData) {
        return (
            <div className="flex flex-col h-full bg-background">
                <StudioToolbar
                    tableName={tableName || tableId}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    rowCount={tableData.rows.length}
                    totalCount={tableData.totalCount}
                    executionTime={tableData.executionTime}
                    onToggleSidebar={onToggleSidebar}
                    onRefresh={loadTableData}
                    onExport={handleExport}
                    isLoading={isLoading}
                />

                <div className="flex-1 overflow-auto p-4">
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-medium text-sidebar-foreground mb-4">
                            Table Structure
                        </h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-sidebar-border">
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Column</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Type</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nullable</th>
                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Primary Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.columns.map((col: ColumnDefinition) => (
                                    <tr key={col.name} className="border-b border-sidebar-border/50">
                                        <td className="py-2 px-3 font-mono text-sidebar-foreground">{col.name}</td>
                                        <td className="py-2 px-3 font-mono text-primary">{col.type}</td>
                                        <td className="py-2 px-3">
                                            {col.nullable ? (
                                                <span className="text-muted-foreground">Yes</span>
                                            ) : (
                                                <span className="text-warning">No</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3">
                                            {col.primaryKey && (
                                                <span className="text-warning font-medium">PK</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex gap-2 mt-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={function () { setShowAddColumnDialog(true); }}
                                className="gap-2"
                            >
                                <Columns className="h-4 w-4" />
                                Add Column
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={function () { setShowDropTableDialog(true); }}
                                className="gap-2 text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4" />
                                Drop Table
                            </Button>
                        </div>
                    </div>
                </div>

                <BottomStatusBar
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    rowCount={tableData.rows.length}
                    totalCount={tableData.totalCount}
                    executionTime={tableData.executionTime}
                />

                <AddColumnDialog
                    open={showAddColumnDialog}
                    onOpenChange={setShowAddColumnDialog}
                    tableName={tableName || tableId}
                    onSubmit={handleAddColumn}
                    isLoading={isDdlLoading}
                />

                <DropTableDialog
                    open={showDropTableDialog}
                    onOpenChange={setShowDropTableDialog}
                    tableName={tableName || tableId}
                    onConfirm={handleDropTable}
                    isLoading={isDdlLoading}
                />
            </div>
        );
    }

    // Content view (default)
    return (
        <div className="flex flex-col h-full bg-background relative">
            <StudioToolbar
                tableName={tableName || tableId}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onToggleSidebar={onToggleSidebar}
                onRefresh={loadTableData}
                onExport={handleExport}
                onAddRecord={handleAddRecord}
                isLoading={isLoading}
                filters={filters}
                onFiltersChange={setFilters}
                columns={tableData?.columns || []}
                visibleColumns={visibleColumns}
                onToggleColumn={handleToggleColumn}
                isDryEditMode={isDryEditMode}
                onDryEditModeChange={setDryEditMode}
            />

            <div className="flex-1 overflow-hidden">
                {showSkeleton ? (
                    <TableSkeleton rows={12} columns={Math.min(visibleColumns.size || 6, 8)} />
                ) : tableData ? (
                    <DataGrid
                        columns={tableData.columns.filter(col => visibleColumns.has(col.name))}
                        rows={tableData.rows}
                        selectedRows={selectedRows}
                        onRowSelect={handleRowSelect}
                        onRowsSelect={handleRowsSelect}
                        onSelectAll={handleSelectAll}
                        sort={sort}
                        onSortChange={setSort}
                        onFilterAdd={function (filter) { setFilters(function (prev) { return [...prev, filter]; }); }}
                        onCellEdit={handleCellEdit}
                        onBatchCellEdit={handleBatchCellEdit}
                        onRowAction={handleRowAction}
                        tableName={tableName || tableId}
                        selectedCells={selectedCells}
                        onCellSelectionChange={setSelectedCells}
                        initialFocusedCell={focusedCell}
                        onFocusedCellChange={setFocusedCell}
                        onContextMenuChange={setContextMenuState}
                        draftRow={draftRow}
                        onDraftChange={handleDraftChange}
                        onDraftSave={handleDraftSave}
                        onDraftCancel={handleDraftCancel}
                        pendingEdits={tableId ? new Set(getEditsForTable(tableId).map(e => `${e.primaryKeyValue}:${e.columnName}`)) : undefined}
                        draftInsertIndex={draftInsertIndex}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-sm">No data available</div>
                    </div>
                )}
            </div>

            {tableData && settings.selectionBarStyle === "static" && selectedRows.size > 0 && (
                <SelectionActionBar
                    selectedCount={selectedRows.size}
                    onDelete={handleBulkDelete}
                    onCopy={handleBulkCopy}
                    onSetNull={handleOpenSetNull}
                    onDuplicate={handleBulkDuplicate}
                    onExportJson={handleExportJson}
                    onExportCsv={handleExportCsv}
                    onBulkEdit={handleOpenBulkEdit}
                    onClearSelection={handleClearSelection}
                    mode="static"
                />
            )}

            {tableData && (
                <BottomStatusBar
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    rowCount={tableData.rows.length}
                    totalCount={tableData.totalCount}
                    executionTime={tableData.executionTime}
                />
            )}

            {/* Render floating bar if mode is floating OR default (undefined) */}
            {tableData && (settings.selectionBarStyle === "floating" || !settings.selectionBarStyle) && selectedRows.size > 0 && (
                <SelectionActionBar
                    selectedCount={selectedRows.size}
                    onDelete={handleBulkDelete}
                    onCopy={handleBulkCopy}
                    onDuplicate={handleBulkDuplicate}
                    onExportJson={handleExportJson}
                    onExportCsv={handleExportCsv}
                    onSetNull={handleOpenSetNull}
                    onBulkEdit={handleOpenBulkEdit}
                    onClearSelection={handleClearSelection}
                    mode="floating"
                />
            )}

            {tableId && hasEdits(tableId) && (
                <PendingChangesBar
                    editCount={getEditCount(tableId)}
                    isApplying={isApplyingEdits}
                    onApply={handleApplyPendingEdits}
                    onCancel={handleDiscardPendingEdits}
                />
            )}

            <AddRecordDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                columns={tableData?.columns || []}
                onSubmit={handleAddRecordSubmit}
                isLoading={insertRow.isPending}
                initialData={duplicateInitialData}
                mode={addDialogMode}
            />

            {tableData && selectedRowForDetail && (
                <RowDetailPanel
                    open={showRowDetail}
                    onClose={function closeRowDetail() { setShowRowDetail(false); }}
                    row={selectedRowForDetail}
                    columns={tableData.columns}
                    tableName={tableName || tableId}
                />
            )}

            {tableData && (
                <BulkEditDialog
                    open={showBulkEditDialog}
                    onOpenChange={setShowBulkEditDialog}
                    columns={tableData.columns}
                    selectedCount={selectedRows.size}
                    isLoading={isBulkActionLoading}
                    onSubmit={function handleBulkEditSubmit(columnName: string, newValue: unknown) {
                        if (!activeConnectionId || !tableId || !tableData) return;

                        const primaryKeyColumn = tableData.columns.find(function (c) { return c.primaryKey; });
                        if (!primaryKeyColumn) {
                            console.error("No primary key found");
                            return;
                        }

                        setIsBulkActionLoading(true);
                        const rowIndexes = Array.from(selectedRows);

                        Promise.all(rowIndexes.map(function (rowIndex) {
                            const row = tableData.rows[rowIndex];
                            return updateCell.mutateAsync({
                                connectionId: activeConnectionId,
                                tableName: tableName || tableId,
                                primaryKeyColumn: primaryKeyColumn.name,
                                primaryKeyValue: row[primaryKeyColumn.name],
                                columnName,
                                newValue
                            });
                        })).then(function () {
                            setShowBulkEditDialog(false);
                            setSelectedRows(new Set());
                            loadTableData();
                        }).catch(function (error) {
                            console.error("Failed to bulk edit:", error);
                        }).finally(function () {
                            setIsBulkActionLoading(false);
                        });
                    }}
                />
            )}

            {tableData && (
                <SetNullDialog
                    open={showSetNullDialog}
                    onOpenChange={setShowSetNullDialog}
                    columns={tableData.columns}
                    selectedCount={selectedRows.size}
                    isLoading={isBulkActionLoading}
                    onSubmit={function handleSetNullSubmit(columnName: string) {
                        if (!activeConnectionId || !tableId || !tableData) return;

                        const primaryKeyColumn = tableData.columns.find(function (c) { return c.primaryKey; });
                        if (!primaryKeyColumn) {
                            console.error("No primary key found");
                            return;
                        }

                        setIsBulkActionLoading(true);
                        const rowIndexes = Array.from(selectedRows);

                        Promise.all(rowIndexes.map(function (rowIndex) {
                            const row = tableData.rows[rowIndex];
                            return updateCell.mutateAsync({
                                connectionId: activeConnectionId,
                                tableName: tableName || tableId,
                                primaryKeyColumn: primaryKeyColumn.name,
                                primaryKeyValue: row[primaryKeyColumn.name],
                                columnName,
                                newValue: null
                            });
                        })).then(function () {
                            setShowSetNullDialog(false);
                            setSelectedRows(new Set());
                            loadTableData();
                        }).catch(function (error) {
                            console.error("Failed to set null:", error);
                        }).finally(function () {
                            setIsBulkActionLoading(false);
                        });
                    }}
                />
            )}
        </div>
    );
}
