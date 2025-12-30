import { X, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";

type BulkAction = "truncate" | "drop";

type Props = {
  selectedCount: number;
  onAction: (action: BulkAction) => void;
  onClose: () => void;
};

export function ManageTablesDialog({ selectedCount, onAction, onClose }: Props) {
  return (
    <div className="absolute left-full top-0 ml-2 w-64 rounded-lg border border-sidebar-border bg-card p-4 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Manage tables</h3>
          <p className="text-xs text-muted-foreground">
            {selectedCount} table{selectedCount !== 1 ? "s" : ""} selected
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-sidebar-foreground"
          onClick={() => onAction("truncate")}
        >
          <Scissors className="h-4 w-4" />
          <span>Truncate</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          onClick={() => onAction("drop")}
        >
          <Trash2 className="h-4 w-4" />
          <span>Drop</span>
        </Button>
      </div>
    </div>
  );
}

export type { BulkAction };
