import { useState, useRef, useEffect } from "react";
import { X, Plus, Filter, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ColumnDefinition, FilterDescriptor, FilterOperator } from "../types";
import { cn } from "@/shared/utils/cn";

type Props = {
    filters: FilterDescriptor[];
    onFiltersChange: (filters: FilterDescriptor[]) => void;
    columns: ColumnDefinition[];
    isVisible: boolean;
};

export function FilterBar({ filters, onFiltersChange, columns, isVisible }: Props) {
    const [isAddingFilter, setIsAddingFilter] = useState(false);
    const [newFilterColumn, setNewFilterColumn] = useState("");
    const [newFilterOperator, setNewFilterOperator] = useState<FilterOperator>("eq");
    const [newFilterValue, setNewFilterValue] = useState("");

    // Auto-focus input when adding filter
    const valueInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAddingFilter && valueInputRef.current) {
            valueInputRef.current.focus();
        }
    }, [isAddingFilter]);

    if (!isVisible) return null;

    function removeFilter(index: number) {
        const newFilters = [...filters];
        newFilters.splice(index, 1);
        onFiltersChange(newFilters);
    };

    function clearFilters() {
        onFiltersChange([]);
    };

    function startAddingFilter() {
        if (columns.length > 0) {
            setNewFilterColumn(columns[0].name);
        }
        setIsAddingFilter(true);
        setNewFilterValue("");
    };

    function saveNewFilter() {
        if (!newFilterColumn) return;

        onFiltersChange([
            ...filters,
            {
                column: newFilterColumn,
                operator: newFilterOperator,
                value: newFilterValue
            }
        ]);
        setIsAddingFilter(false);
        setNewFilterValue("");
    };

    function cancelAddingFilter() {
        setIsAddingFilter(false);
        setNewFilterValue("");
    };

    return (
        <div className="flex flex-col border-b border-sidebar-border bg-sidebar-accent/10">
            {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2 px-2 h-9 border-b border-sidebar-border/50 last:border-0 group bg-sidebar-accent/5 hover:bg-sidebar-accent/20 transition-colors">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFilter(index)}
                    >
                        <X className="h-3 w-3" />
                    </Button>

                    <span className="text-[10px] uppercase text-muted-foreground font-bold w-8 text-center tracking-wider select-none">
                        {index === 0 ? "WHERE" : "AND"}
                    </span>

                    <div className="flex items-center gap-2 text-xs flex-1">
                        <span className="font-mono text-primary font-medium px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5">
                            {filter.column}
                        </span>
                        <div className="relative">
                            <select
                                className="h-6 text-xs bg-background border border-sidebar-border rounded px-2 w-[110px] appearance-none focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                                value={filter.operator}
                                onChange={(e) => {
                                    const newFilters = [...filters];
                                    newFilters[index].operator = e.target.value as FilterOperator;
                                    onFiltersChange(newFilters);
                                }}
                            >
                                <option value="eq">equals</option>
                                <option value="neq">not equal</option>
                                <option value="gt">greater than</option>
                                <option value="lt">less than</option>
                                <option value="gte">greater or equal</option>
                                <option value="lte">less or equal</option>
                                <option value="contains">contains</option>
                                <option value="ilike">ilike</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <ChevronDown className="h-3 w-3" />
                            </div>
                        </div>
                        <span className="font-mono text-foreground font-medium px-1.5 py-0.5 rounded border border-border bg-background">
                            {String(filter.value)}
                        </span>
                    </div>
                </div>
            ))}

            {/* Add Filter Row */}
            {isAddingFilter ? (
                <div className="flex items-center gap-2 px-2 h-9 border-b border-sidebar-border bg-sidebar-accent/20">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-sidebar-foreground"
                        onClick={cancelAddingFilter}
                    >
                        <X className="h-3 w-3" />
                    </Button>

                    <span className="text-xs text-muted-foreground font-mono w-12 text-center">
                        {filters.length === 0 ? "where" : "and"}
                    </span>

                    <div className="relative">
                        <select
                            className="h-6 text-xs bg-background border border-sidebar-border rounded px-2 min-w-[120px] appearance-none focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                            value={newFilterColumn}
                            onChange={(e) => setNewFilterColumn(e.target.value)}
                        >
                            {columns.map(col => (
                                <option key={col.name} value={col.name}>{col.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                            <ChevronDown className="h-3 w-3" />
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            className="h-6 text-xs bg-background border border-sidebar-border rounded px-2 w-[110px] appearance-none focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                            value={newFilterOperator}
                            onChange={(e) => setNewFilterOperator(e.target.value as FilterOperator)}
                        >
                            <option value="eq">equals</option>
                            <option value="neq">not equal</option>
                            <option value="gt">greater than</option>
                            <option value="lt">less than</option>
                            <option value="gte">greater or equal</option>
                            <option value="lte">less or equal</option>
                            <option value="contains">contains</option>
                            <option value="ilike">ilike</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                            <ChevronDown className="h-3 w-3" />
                        </div>
                    </div>

                    <Input
                        ref={valueInputRef}
                        className="h-6 text-xs w-[200px]"
                        placeholder="Value..."
                        value={newFilterValue}
                        onChange={(e) => setNewFilterValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveNewFilter();
                            if (e.key === 'Escape') cancelAddingFilter();
                        }}
                    />

                    <Button
                        size="sm"
                        variant="default"
                        className="h-6 px-2 text-[10px]"
                        onClick={saveNewFilter}
                    >
                        Apply
                    </Button>
                </div>
            ) : (
                <div className="flex items-center px-2 h-9 gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5"
                        onClick={startAddingFilter}
                    >
                        <Plus className="h-3 w-3" />
                        Add filter
                    </Button>

                    {filters.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive gap-1.5 ml-auto"
                            onClick={clearFilters}
                        >
                            <Trash2 className="h-3 w-3" />
                            Clear filters
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
