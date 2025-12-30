import { Settings, Monitor, Bell, Bug, Heart } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

type ToolbarAction = "settings" | "theme" | "notifications" | "bug" | "sponsor";

type ToolbarItem = {
  id: ToolbarAction;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: "settings", icon: Settings, label: "Settings" },
  { id: "theme", icon: Monitor, label: "Toggle theme" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "bug", icon: Bug, label: "Report a bug" },
  { id: "sponsor", icon: Heart, label: "Support" },
];

type Props = {
  onAction: (action: ToolbarAction) => void;
};

export function BottomToolbar({ onAction }: Props) {
  return (
    <div className="flex items-center justify-around px-2 py-2.5 border-t border-sidebar-border mt-auto">
      {TOOLBAR_ITEMS.map((item) => (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => onAction(item.id)}
            >
              <item.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export type { ToolbarAction };
