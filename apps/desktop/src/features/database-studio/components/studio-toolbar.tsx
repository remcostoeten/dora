import { useState, useEffect } from "react";
import {
    PanelLeft,
    History,
    Filter,
    Columns3,
    Plus,
    RefreshCw,
    Download,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Table,
    FileJson,
    Clock,
    Trash2,
    Edit3
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { ViewMode, PaginationState, FilterDescriptor, ColumnDefinition } from "../types";
import { FilterBar } from "./filter-bar";

interface HistoryEntry {
    id: string;
    tableName: string;
    query: string;
    timestamp: number;
}

type Props = {
    tableName: string;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    pagination: PaginationState;
    onPaginationChange: (pagination: PaginationState) => void;
    rowCount: number;
    totalCount: number;
    executionTime: number;
    onToggleSidebar?: () => void;
    onRefresh: () => void;
    onExport: () => void;
    onAddRecord?: () => void;
    isLoading?: boolean;
    filters?: FilterDescriptor[];
    onFiltersChange?: (filters: FilterDescriptor[]) => void;
    columns?: ColumnDefinition[];
    visibleColumns?: Set<string>;
    onToggleColumn?: (columnName: string, visible: boolean) => void;
    isDryEditMode?: boolean;
    onDryEditModeChange?: (enabled: boolean) => void;
};

export function StudioToolbar({
    tableName,
    viewMode,
    onViewModeChange,
    pagination,
    onPaginationChange,
    rowCount,
    totalCount,
    executionTime,
    onToggleSidebar,
    onRefresh,
    onExport,
    onAddRecord,
    isLoading,
    filters = [],
    onFiltersChange,
    columns = [],
    visibleColumns,
    onToggleColumn,
    isDryEditMode,
    onDryEditModeChange,
}: Props) {
    const [limitInput, setLimitInput] = useState(String(pagination.limit));
    const [offsetInput, setOffsetInput] = useState(String(pagination.offset));
    const [showFilters, setShowFilters] = useState(filters.length > 0);

    // Navigation history state
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Add current view to history
    useEffect(() => {
        if (!tableName) return;

        const newEntry: HistoryEntry = {
            id: Date.now().toString(),
            tableName,
            query: `SELECT * FROM ${tableName} LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
            timestamp: Date.now(),
        };

        setHistory(prev => {
            // If we're not at the end of history, remove forward history
            const newHistory = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [...prev];
            // Add new entry (limit to 50)
            return [...newHistory, newEntry].slice(-50);
        });

        setHistoryIndex(prev => Math.min(prev + 1, history.length));
    }, [tableName, pagination.limit, pagination.offset]);

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < history.length - 1;

    const handleHistoryBack = () => {
        if (canGoBack) {
            setHistoryIndex(prev => prev - 1);
            const entry = history[historyIndex - 1];
            // Parse the entry's query to extract table/pagination info
            // For now, just trigger a refresh
            onRefresh();
        }
    };

    const handleHistoryForward = () => {
        if (canGoForward) {
            setHistoryIndex(prev => prev + 1);
            const entry = history[historyIndex + 1];
            onRefresh();
        }
    };

    const handleClearHistory = () => {
        setHistory([]);
        setHistoryIndex(-1);
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    };

    // Update local inputs when pagination changes externally
    useEffect(() => {
        setLimitInput(String(pagination.limit));
        setOffsetInput(String(pagination.offset));
    }, [pagination]);

    // Update showFilters if filters are added externally (e.g. from context menu)
    useEffect(() => {
        if (filters.length > 0) {
            setShowFilters(true);
        }
    }, [filters.length]);

    const handleLimitChange = (value: string) => {
        setLimitInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
            onPaginationChange({ ...pagination, limit: num });
        }
    };

    const handleOffsetChange = (value: string) => {
        setOffsetInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0) {
            onPaginationChange({ ...pagination, offset: num });
        }
    };

    const handleNextPage = () => {
        onPaginationChange({ ...pagination, offset: pagination.offset + pagination.limit });
    };

    const handlePrevPage = () => {
        const newOffset = Math.max(0, pagination.offset - pagination.limit);
        onPaginationChange({ ...pagination, offset: newOffset });
    };

    return (
        <div className="flex flex-col shrink-0 bg-sidebar border-b border-sidebar-border">
            {/* Main Single-Row Toolbar */}
            <div className="flex items-center h-10 px-2 gap-2 text-sm">
                {/* Left Section: Navigation & View Controls */}
                <div className="flex items-center gap-1 mr-2">
                    {onToggleSidebar && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={onToggleSidebar}
                            title="Toggle sidebar"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                    )}

                    <div className="h-4 w-px bg-sidebar-border mx-1" />

                    {/* View Switcher */}
                    <div className="flex items-center bg-sidebar-accent/50 rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 rounded-sm",
                                viewMode === "content"
                                    ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent"
                            )}
                            onClick={() => onViewModeChange("content")}
                            title="Content View"
                        >
                            <Table className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 rounded-sm",
                                viewMode === "structure"
                                    ? "bg-sidebar-accent text-sidebar-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent"
                            )}
                            onClick={() => onViewModeChange("structure")}
                            title="Structure View"
                        >
                            <FileJson className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="h-4 w-px bg-sidebar-border mx-1" />

                    {/* Navigation History */}
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground disabled:opacity-30"
                            disabled={!canGoBack}
                            onClick={handleHistoryBack}
                            title="Back"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground disabled:opacity-30"
                            disabled={!canGoForward}
                            onClick={handleHistoryForward}
                            title="Forward"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                                title="History"
                            >
                                <History className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[280px] max-h-[400px] overflow-auto">
                            <div className="flex items-center justify-between px-2 py-1.5 border-b border-sidebar-border/50">
                                <span className="text-xs font-medium text-sidebar-foreground">History</span>
                                {history.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={handleClearHistory}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                            <DropdownMenuSeparator />
                            {history.length === 0 ? (
                                <div className="flex flex-col gap-1 p-4 text-center">
                                    <History className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                    <span className="text-xs text-muted-foreground">No history yet</span>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {[...history].reverse().map((entry, reverseIndex) => {
                                        const actualIndex = history.length - 1 - reverseIndex;
                                        const isCurrent = actualIndex === historyIndex;
                                        return (
                                            <DropdownMenuItem
                                                key={entry.id}
                                                className={cn(
                                                    "flex flex-col items-start gap-0.5 py-2",
                                                    isCurrent && "bg-sidebar-accent"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="text-xs font-medium text-sidebar-foreground truncate">
                                                        {entry.tableName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 w-full pl-5">
                                                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                                                        {entry.query}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/70 shrink-0 ml-auto">
                                                        {formatTimestamp(entry.timestamp)}
                                                    </span>
                                                </div>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Filter Toggle */}
                    <Button
                        variant={showFilters || filters.length > 0 ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                            "h-7 px-2 text-xs gap-1.5 ml-1",
                            (showFilters || filters.length > 0) && "text-sidebar-foreground bg-sidebar-accent"
                        )}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Filters</span>
                        {filters.length > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] px-1 rounded-full min-w-[14px] h-3.5 flex items-center justify-center">
                                {filters.length}
                            </span>
                        )}
                    </Button>

                    {/* Columns Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5"
                            >
                                <Columns3 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Columns</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-auto">
                            <div className="px-2 py-1.5 border-b border-sidebar-border/50 sticky top-0 bg-popover z-10">
                                <Input
                                    placeholder="Search columns..."
                                    className="h-7 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 px-0"
                                />
                            </div>
                            {columns.map(col => (
                                <DropdownMenuCheckboxItem
                                    key={col.name}
                                    checked={visibleColumns ? visibleColumns.has(col.name) : true}
                                    onCheckedChange={(checked) => onToggleColumn?.(col.name, !!checked)}
                                >
                                    {col.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex-1" />

                {/* Right Section: Actions & Stats */}
                <div className="flex items-center gap-2">
                    {onDryEditModeChange && (
                        <Button
                            variant={isDryEditMode ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-7 px-2 text-xs gap-1.5",
                                isDryEditMode && "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                            )}
                            onClick={function () { onDryEditModeChange(!isDryEditMode); }}
                            title={isDryEditMode ? "Disable dry edit mode" : "Enable dry edit mode (stage changes before saving)"}
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{isDryEditMode ? "Dry Edit" : "Dry Edit"}</span>
                        </Button>
                    )}

                    <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 mr-2"
                        onClick={onAddRecord}
                        disabled={!onAddRecord}
                        title={onAddRecord ? "Add new record" : "Not connected to backend"}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Add record</span>
                    </Button>

                    <div className="h-4 w-px bg-sidebar-border mx-1" />

                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">
                        {rowCount} rows • {executionTime}ms
                    </span>

                    <div className="flex items-center gap-1 text-xs">
                        <Input
                            type="number"
                            value={limitInput}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            className="h-7 w-14 text-xs px-2 text-center"
                            title="Limit"
                        />
                        <Input
                            type="number"
                            value={offsetInput}
                            onChange={(e) => handleOffsetChange(e.target.value)}
                            className="h-7 w-14 text-xs px-2 text-center"
                            title="Offset"
                        />
                        <div className="flex items-center rounded-md border border-input shadow-xs">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-none rounded-l-md border-r border-input"
                                onClick={handlePrevPage}
                                disabled={pagination.offset === 0}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-none rounded-r-md"
                                onClick={handleNextPage}
                                disabled={rowCount < pagination.limit}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <div className="h-4 w-px bg-sidebar-border mx-1" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Refresh"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                        onClick={onExport}
                        disabled={rowCount === 0}
                        title="Export JSON"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <FilterBar
                isVisible={showFilters}
                filters={filters}
                onFiltersChange={onFiltersChange || (() => { })}
                columns={columns}
            />
        </div>
    );
}
