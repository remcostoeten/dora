import { Settings, Monitor, Bell, Bug, Heart } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { SettingsPanel } from "./settings-panel";
import { ThemePanel } from "./theme-panel";

type Theme = "dark" | "light";

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
  onCopySchema?: () => void;
  themeProps?: {
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
  };
};

export function BottomToolbar({ onAction, onCopySchema, themeProps }: Props) {
  return (
    <div className="flex items-center justify-around px-2 py-2.5 border-t border-sidebar-border mt-auto">
      {TOOLBAR_ITEMS.map((item) => {
        if (item.id === "settings") {
          return (
            <Popover key={item.id}>
              <PopoverTrigger asChild>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="end"
                sideOffset={16}
                className="w-[240px] p-0 mb-2 ml-2"
              >
                <SettingsPanel onCopySchema={onCopySchema} />
              </PopoverContent>
            </Popover>
          );
        }

        if (item.id === "theme" && themeProps) {
          return (
            <Popover key={item.id}>
              <PopoverTrigger asChild>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="end"
                sideOffset={16}
                className="w-[340px] p-0 mb-2 ml-2"
              >
                <ThemePanel
                  theme={themeProps.theme}
                  onThemeChange={themeProps.onThemeChange}
                />
              </PopoverContent>
            </Popover>
          );
        }

        return (
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
        );
      })}
    </div>
  );
}

export type { ToolbarAction, Theme };
