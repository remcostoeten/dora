import { useState, useEffect, useCallback } from "react";
import { Database, Plus, PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { StudioToolbar } from "./components/studio-toolbar";
import { DataGrid } from "./components/data-grid";
import { AddRecordDialog } from "./components/add-record-dialog";
import { RowDetailPanel } from "./components/row-detail-panel";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAdapter, useDataMutation } from "@/core/data-provider";
import { useSettings } from "@/core/settings";
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

    // Default to all visible initially
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());

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

    useEffect(() => {
        loadTableData();
    }, [loadTableData]);

    // Reset state when table changes
    useEffect(() => {
        setPagination({ limit: 50, offset: 0 });
        setSort(undefined);
        setFilters([]);
        setVisibleColumns(new Set()); // Will be repopulated on data load
    }, [tableId]);

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

    const handleCellEdit = async (rowIndex: number, columnName: string, newValue: unknown) => {
        if (!tableId || !activeConnectionId || !tableData) return;

        const row = tableData.rows[rowIndex];
        const primaryKeyColumn = tableData.columns.find(c => c.primaryKey);
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        updateCell.mutate({
            connectionId: activeConnectionId,
            tableName: tableName || tableId,
            primaryKeyColumn: primaryKeyColumn.name,
            primaryKeyValue: row[primaryKeyColumn.name],
            columnName,
            newValue
        }, {
            onSuccess: () => {
                loadTableData();
            },
            onError: (error) => {
                console.error("Failed to update cell:", error);
            }
        });
    };

    const handleBatchCellEdit = async (rowIndexes: number[], columnName: string, newValue: unknown) => {
        if (!tableId || !activeConnectionId || !tableData) return;

        const primaryKeyColumn = tableData.columns.find(c => c.primaryKey);
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        // Sequential updates for now, as adapter lacks batch update
        // We trigger reload only after all are initiated. 
        // Note: Using mutateAsync would be better to await all, but mutate is fire-and-forget.
        // Let's use mutateAsync.

        try {
            await Promise.all(rowIndexes.map(async (rowIndex) => {
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
            loadTableData();
        } catch (error) {
            console.error("Failed to batch update cells:", error);
        }
    };

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
                setDuplicateInitialData(duplicateData);
                setAddDialogMode("duplicate");
                setShowAddDialog(true);
                break;
            default:
                console.log("Row action:", action, row);
        }
    };

    function handleAddRecord() {
        setDuplicateInitialData(undefined);
        setAddDialogMode("add");
        setShowAddDialog(true);
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
                    </div>
                </div>
            </div>
        );
    }

    // Content view (default)
    return (
        <div className="flex flex-col h-full bg-background">
            <StudioToolbar
                tableName={tableName || tableId}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={tableData?.rows.length ?? 0}
                totalCount={tableData?.totalCount ?? 0}
                executionTime={tableData?.executionTime ?? 0}
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
                        onFilterAdd={(filter) => setFilters(prev => [...prev, filter])}
                        onCellEdit={handleCellEdit}
                        onBatchCellEdit={handleBatchCellEdit}
                        onRowAction={handleRowAction}
                        tableName={tableName || tableId}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-sm">No data available</div>
                    </div>
                )}
            </div>

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
        </div>
    );
}
