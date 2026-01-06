import {
  Database,
  Table2,
  Eye,
  Layers,
  FolderPlus,
  Plus,
  FileSpreadsheet,
  Users,
  Shield,
  Upload,
  Search,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type AddAction =
  | "create-schema"
  | "create-table"
  | "create-view"
  | "create-enum"
  | "create-role"
  | "create-policy"
  | "import-csv";

type AddMenuItem = {
  id: AddAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ADD_MENU_ITEMS: AddMenuItem[] = [
  { id: "create-schema", label: "Create schema", icon: FolderPlus },
  { id: "create-table", label: "Create table", icon: Table2 },
  { id: "create-view", label: "Create view", icon: Eye },
  { id: "create-enum", label: "Create enum", icon: Layers },
  { id: "create-role", label: "Create role", icon: Users },
  { id: "create-policy", label: "Create policy", icon: Shield },
  { id: "import-csv", label: "Import CSV", icon: Upload },
];

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAction: (action: AddAction) => void;
  children: React.ReactNode;
};

export function AddMenu({ open, onOpenChange, onAction, children }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = isControlled ? onOpenChange : setInternalOpen;

  const filteredItems = ADD_MENU_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px] p-0">
        <div className="flex items-center px-2 py-1.5 border-b border-sidebar-border/50 sticky top-0 bg-popover z-10">
          <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
          <input
            className="flex-1 bg-transparent outline-hidden text-xs placeholder:text-muted-foreground/70 min-w-0"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="p-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  onAction(item.id);
                  setSearchQuery("");
                }}
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
              No results
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { AddAction };
