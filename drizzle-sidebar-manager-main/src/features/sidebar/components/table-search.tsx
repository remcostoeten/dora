import { Search, Filter, RefreshCw, Plus } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type FilterState = {
  showTables: boolean;
  showViews: boolean;
  showMaterializedViews: boolean;
};

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
  onAddClick: () => void;
};

export function TableSearch({
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
  onRefresh,
  onAddClick,
}: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <Input
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 bg-transparent border-sidebar-border/60 text-sm pl-3 pr-3 text-sidebar-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-sidebar-ring focus-visible:border-sidebar-border"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuCheckboxItem
            checked={filters.showTables}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, showTables: checked })
            }
          >
            Show tables
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.showViews}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, showViews: checked })
            }
          >
            Show views
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.showMaterializedViews}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, showMaterializedViews: checked })
            }
          >
            Show materialized views
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        onClick={onRefresh}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        onClick={onAddClick}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type { FilterState };
