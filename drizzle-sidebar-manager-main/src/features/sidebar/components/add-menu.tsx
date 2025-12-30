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
} from "lucide-react";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: AddAction) => void;
  children: React.ReactNode;
};

export function AddMenu({ open, onOpenChange, onAction, children }: Props) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {ADD_MENU_ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => onAction(item.id)}
            className="gap-2"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { AddAction };
