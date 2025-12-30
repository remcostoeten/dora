import { useState, useEffect, useCallback } from "react";
import { StudioToolbar } from "./components/studio-toolbar";
import { DataGrid } from "./components/data-grid";
import { getTableData } from "./data";
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
};

export function DatabaseStudio({ tableId, tableName, onToggleSidebar }: Props) {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("content");
    const [pagination, setPagination] = useState<PaginationState>({ limit: 50, offset: 0 });
    const [sort, setSort] = useState<SortDescriptor | undefined>();
    const [filters, setFilters] = useState<FilterDescriptor[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const loadTableData = useCallback(async () => {
        if (!tableId) return;

        setIsLoading(true);
        setSelectedRows(new Set());

        try {
            const data = await getTableData({
                tableId,
                limit: pagination.limit,
                offset: pagination.offset,
                sort,
                filters
            });
            setTableData(data);
        } catch (error) {
            console.error("Failed to load table data:", error);
            setTableData(null);
        } finally {
            setIsLoading(false);
        }
    }, [tableId, pagination.limit, pagination.offset, sort, filters]);

    useEffect(() => {
        loadTableData();
    }, [loadTableData]);

    // Reset state when table changes
    useEffect(() => {
        setPagination({ limit: 50, offset: 0 });
        setSort(undefined);
        setFilters([]);
    }, [tableId]);

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

    const handleSelectAll = (checked: boolean) => {
        if (checked && tableData) {
            setSelectedRows(new Set(tableData.rows.map((_, i) => i)));
        } else {
            setSelectedRows(new Set());
        }
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
                                        <td className="py-2 px-3 font-mono text-blue-400">{col.type}</td>
                                        <td className="py-2 px-3">
                                            {col.nullable ? (
                                                <span className="text-muted-foreground">Yes</span>
                                            ) : (
                                                <span className="text-orange-400">No</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3">
                                            {col.primaryKey && (
                                                <span className="text-yellow-500 font-medium">PK</span>
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
                isLoading={isLoading}
                filters={filters}
                onFiltersChange={setFilters}
            />

            <div className="flex-1 overflow-hidden">
                {isLoading && !tableData ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground text-sm">Loading...</div>
                    </div>
                ) : tableData ? (
                    <DataGrid
                        columns={tableData.columns}
                        rows={tableData.rows}
                        selectedRows={selectedRows}
                        onRowSelect={handleRowSelect}
                        onSelectAll={handleSelectAll}
                        sort={sort}
                        onSortChange={setSort}
                        onFilterAdd={(filter) => setFilters(prev => [...prev, filter])}
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
