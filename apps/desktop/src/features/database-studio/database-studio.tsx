import { useState, useEffect, useCallback } from "react";
import { StudioToolbar } from "./components/studio-toolbar";
import { DataGrid } from "./components/data-grid";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAdapter } from "@/core/data-provider";
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
};

export function DatabaseStudio({ tableId, tableName, onToggleSidebar, activeConnectionId }: Props) {
    const adapter = useAdapter();
    const [tableData, setTableData] = useState<TableData | null>(null);
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

        try {
            const result = await adapter.updateCell(
                activeConnectionId,
                tableName || tableId,
                primaryKeyColumn.name,
                row[primaryKeyColumn.name] as any, // Cast to JsonValue
                columnName,
                newValue as any
            );

            if (result.ok) {
                await loadTableData();
            } else {
                console.error("Failed to update cell:", result.error);
            }
        } catch (error) {
            console.error("Failed to update cell:", { tableId, rowIndex, columnName, newValue, error });
        }
    };

    const handleBatchCellEdit = async (rowIndexes: number[], columnName: string, newValue: unknown) => {
        if (!tableId || !activeConnectionId || !tableData) return;

        const primaryKeyColumn = tableData.columns.find(c => c.primaryKey);
        if (!primaryKeyColumn) {
            console.error("No primary key found");
            return;
        }

        try {
            // Note: DataAdapter doesn't support batch update natively yet, so we loop
            // In a real implementation we should add batch update to the adapter
            for (const rowIndex of rowIndexes) {
                const row = tableData.rows[rowIndex];
                const result = await adapter.updateCell(
                    activeConnectionId,
                    tableName || tableId,
                    primaryKeyColumn.name,
                    row[primaryKeyColumn.name] as any,
                    columnName,
                    newValue as any
                );
                if (!result.ok) {
                    console.error(`Failed to update row ${rowIndex}:`, result.error);
                }
            }
            await loadTableData();
        } catch (error) {
            console.error("Failed to batch update cells:", { tableId, rowIndexes, columnName, newValue, error });
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
                try {
                    const result = await adapter.deleteRows(
                        activeConnectionId,
                        tableName || tableId,
                        primaryKeyColumn.name,
                        [row[primaryKeyColumn.name] as any]
                    );

                    if (result.ok) {
                        await loadTableData();
                    } else {
                        console.error("Failed to delete row:", result.error);
                    }
                } catch (error) {
                    console.error("Failed to delete row:", { tableId, rowIndex, error });
                }
                break;
            case "view":
                console.log("View row:", row);
                break;
            case "edit":
                console.log("Edit row:", row);
                break;
            case "duplicate":
                console.log("Duplicate row:", row);
                break;
            default:
                console.log("Row action:", action, row);
        }
    };

    const handleAddRecord = () => {
        console.log("Add record - Will connect to adapter");
        // TODO: Call adapter to add new record
    };

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

    // No table selected
    if (!tableId) {
        return (
            <div className="flex flex-col h-full">
                {onToggleSidebar && (
                    <div className="flex items-center h-11 border-b border-sidebar-border bg-sidebar shrink-0 px-3">
                        <button
                            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
                            onClick={onToggleSidebar}
                            title="Toggle sidebar"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                        </button>
                        <span className="ml-3 text-sm text-sidebar-foreground">Database Studio</span>
                    </div>
                )}

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-foreground mb-2">
                            Database Studio
                        </h1>
                        <p className="text-muted-foreground">
                            Select a table from the sidebar to browse data
                        </p>
                    </div>
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
        </div>
    );
}
