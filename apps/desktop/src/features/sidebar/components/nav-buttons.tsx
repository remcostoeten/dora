import { Terminal, Play, Database } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { id: "sql-console", label: "Console", icon: Terminal },
  { id: "database-studio", label: "Database studio", icon: Database },
];

type Props = {
  activeId?: string;
  onSelect?: (id: string) => void;
};

export function NavButtons({ activeId = "database-studio", onSelect }: Props) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 h-9 text-sm rounded-md transition-all text-left border",
            activeId === item.id
              ? "bg-sidebar-accent border-sidebar-border text-sidebar-foreground"
              : "border-transparent text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:border-sidebar-border/50"
          )}
          onClick={() => onSelect?.(item.id)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
