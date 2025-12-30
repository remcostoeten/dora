import {
  Eye,
  PenLine,
  Shield,
  Scissors,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type TableAction =
  | "browse-data"
  | "alter-table"
  | "enable-rls"
  | "truncate"
  | "drop";

type ContextMenuItem = {
  id: TableAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "destructive";
};

const CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  { id: "browse-data", label: "Browse data", icon: Eye },
  { id: "alter-table", label: "Alter table", icon: PenLine },
  { id: "enable-rls", label: "Enable RLS", icon: Shield },
  { id: "truncate", label: "Truncate", icon: Scissors },
  { id: "drop", label: "Drop", icon: Trash2, variant: "destructive" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: TableAction) => void;
  children: React.ReactNode;
};

export function TableContextMenu({ open, onOpenChange, onAction, children }: Props) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[160px]">
        {CONTEXT_MENU_ITEMS.map((item, index) => (
          <div key={item.id}>
            {item.id === "truncate" && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => onAction(item.id)}
              className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
            >
              <item.icon className="h-4 w-4 mr-2" />
              <span>{item.label}</span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { TableAction };
