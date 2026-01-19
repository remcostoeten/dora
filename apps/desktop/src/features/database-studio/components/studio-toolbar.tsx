import { useState, useEffect } from "react";
import {
    Table,
    FileJson,
    Trash2,
    Edit3,
    PanelLeft,
    Filter,
    Columns,
    Download,
    Plus,
    RefreshCw
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



type Props = {
    tableName: string;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
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
    isSidebarOpen?: boolean;
};

export function StudioToolbar({
    tableName,
    viewMode,
    onViewModeChange,
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
    isSidebarOpen,
}: Props) {
    const [showFilters, setShowFilters] = useState(filters.length > 0);



    useEffect(() => {
        if (filters.length > 0) {
            setShowFilters(true);
        }
    }, [filters.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                onToggleSidebar?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggleSidebar]);

    return (
        <div className="flex flex-col shrink-0 bg-sidebar border-b border-sidebar-border">
            <div className="flex items-center h-10 px-2 gap-2 text-sm">
                <div className="flex items-center gap-1 mr-2">
                    {onToggleSidebar && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={onToggleSidebar}
                            title="Toggle sidebar (Ctrl+B)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-panel-left"
                            >
                                <rect width="18" height="18" x="3" y="3" rx="2" />
                                <path
                                    d="M9 3v18"
                                    className={cn("transition-all duration-300 ease-in-out", !isSidebarOpen && "-translate-x-[6px]")}
                                    style={{ transformBox: "fill-box" }}
                                />
                            </svg>
                        </Button>
                    )}

                    <div className="h-4 w-px bg-sidebar-border mx-1" />

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

                    3                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5"
                            >
                                <Columns className="h-3.5 w-3.5" />
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
