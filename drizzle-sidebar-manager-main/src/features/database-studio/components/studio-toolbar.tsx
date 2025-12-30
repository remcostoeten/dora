import { useState } from "react";
import {
    PanelLeft,
    History,
    Filter,
    Columns3,
    Plus,
    RefreshCw,
    Download,
    ChevronDown,
    X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { ViewMode, PaginationState, FilterDescriptor } from "../types";

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
    isLoading?: boolean;
    filters?: FilterDescriptor[];
    onFiltersChange?: (filters: FilterDescriptor[]) => void;
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
    isLoading,
    filters = [],
    onFiltersChange,
}: Props) {
    const [limitInput, setLimitInput] = useState(String(pagination.limit));
    const [offsetInput, setOffsetInput] = useState(String(pagination.offset));

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

    const removeFilter = (index: number) => {
        if (!onFiltersChange) return;
        const newFilters = [...filters];
        newFilters.splice(index, 1);
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        onFiltersChange?.([]);
    };

    return (
        <div className="flex flex-col border-b border-sidebar-border bg-sidebar shrink-0">
            {/* Top row - Table name and view toggles */}
            <div className="flex items-center h-11 px-2 gap-2 border-b border-sidebar-border">
                {onToggleSidebar && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground"
                        onClick={onToggleSidebar}
                        title="Toggle sidebar"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </Button>
                )}

                <span className="font-medium text-sidebar-foreground">{tableName}</span>

                <div className="flex items-center ml-4 bg-sidebar-accent/50 rounded-md p-0.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-3 text-xs rounded-sm",
                            viewMode === "content"
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-muted-foreground hover:text-sidebar-foreground"
                        )}
                        onClick={() => onViewModeChange("content")}
                    >
                        Content
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-3 text-xs rounded-sm",
                            viewMode === "structure"
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-muted-foreground hover:text-sidebar-foreground"
                        )}
                        onClick={() => onViewModeChange("structure")}
                    >
                        Structure
                    </Button>
                </div>
            </div>

            {/* Bottom row - Actions and pagination */}
            <div className="flex items-center justify-between h-10 px-2">
                {/* Left side - Action buttons */}
                <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1"
                            >
                                <History className="h-3.5 w-3.5" />
                                History
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[240px]">
                            <DropdownMenuItem className="text-xs text-muted-foreground">
                                <History className="h-3 w-3 mr-2" />
                                <span>Recent queries</span>
                            </DropdownMenuItem>
                            <div className="flex flex-col gap-1 p-1">
                                <div className="flex items-center justify-between px-2 py-1 text-xs hover:bg-sidebar-accent rounded-sm cursor-pointer">
                                    <span className="truncate">SELECT * FROM users</span>
                                    <span className="text-muted-foreground text-[10px]">2m ago</span>
                                </div>
                                <div className="flex items-center justify-between px-2 py-1 text-xs hover:bg-sidebar-accent rounded-sm cursor-pointer">
                                    <span className="truncate">SELECT count(*) FROM orders</span>
                                    <span className="text-muted-foreground text-[10px]">1h ago</span>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-7 px-2 text-xs gap-1",
                                    filters.length > 0
                                        ? "text-blue-400 bg-blue-400/10 hover:bg-blue-400/20"
                                        : "text-muted-foreground hover:text-sidebar-foreground"
                                )}
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Filters
                                {filters.length > 0 && <span className="ml-0.5 font-medium">{filters.length}</span>}
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[280px] p-2">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Active filters</span>
                                    {filters.length > 0 && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {filters.length === 0 ? (
                                    <div className="text-xs text-center py-4 border border-dashed rounded-md text-muted-foreground">
                                        No active filters
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                                        {filters.map((filter, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-sidebar-accent/50 rounded text-xs group">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-mono text-muted-foreground">{filter.column}</span>
                                                    <span className="text-orange-400">{filter.operator}</span>
                                                    <span className="font-medium truncate max-w-[100px]">{String(filter.value)}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFilter(i);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sidebar-accent rounded transition-all"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button size="sm" variant="outline" className="w-full text-xs h-7 mt-1">
                                    <Plus className="h-3 w-3 mr-1" /> Add filter
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1"
                            >
                                <Columns3 className="h-3.5 w-3.5" />
                                Columns
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] p-0">
                            <div className="px-2 py-1.5 border-b border-sidebar-border/50">
                                <Input
                                    placeholder="Search columns..."
                                    className="h-7 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 px-0"
                                />
                            </div>
                            <div className="p-1 max-h-[200px] overflow-y-auto">
                                <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => { }}>
                                    id
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => { }}>
                                    created_at
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => { }}>
                                    updated_at
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={true} onCheckedChange={() => { }}>
                                    name
                                </DropdownMenuCheckboxItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-3 text-xs gap-1 ml-2"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add record
                    </Button>
                </div>

                {/* Right side - Stats and pagination */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {rowCount} of {totalCount} rows • {executionTime}ms
                    </span>

                    <div className="flex items-center gap-2 text-xs">
                        <label className="text-muted-foreground">Limit</label>
                        <Input
                            type="number"
                            value={limitInput}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            className="h-6 w-16 text-xs px-2"
                            min={1}
                        />
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <label className="text-muted-foreground">Offset</label>
                        <Input
                            type="number"
                            value={offsetInput}
                            onChange={(e) => handleOffsetChange(e.target.value)}
                            className="h-6 w-16 text-xs px-2"
                            min={0}
                        />
                    </div>

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
                        title="Export"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
