import {
  Info,
  Sun,
  Moon,
  ChevronRight,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  getAppearanceSettings,
  saveAppearanceSettings,
  applyAppearanceToDOM,
  type Theme,
} from "@studio/shared/lib/appearance-store";
import { Button } from "@studio/shared/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@studio/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@studio/shared/ui/tooltip";
import { AppearancePanel } from "./appearance-panel";
import { ChangelogPanel } from "./changelog-panel";
import { ProjectInfoPanel } from "./project-info-panel";
import { CURRENT_VERSION } from "../changelog-data";
import { SidebarPanelToggle } from "./sidebar-panel-toggle";

type ToolbarAction = "project-info" | "theme" | "settings" | "changelog";

type ToolbarItem = {
  id: ToolbarAction;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

const LIGHT_THEMES: Theme[] = ["light", "claude"];

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: "changelog", icon: Sparkles, label: "What's new" },
  { id: "project-info", icon: Info, label: "Project Info" },
  { id: "theme", icon: Sun, label: "Appearance" },
];

function useCurrentTheme() {
  const [theme, setTheme] = useState<Theme>(getAppearanceSettings().theme);

  useEffect(function listenForThemeChanges() {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.theme) setTheme(detail.theme);
    }
    window.addEventListener("dora-appearance-change", handler);
    return function () {
      window.removeEventListener("dora-appearance-change", handler);
    };
  }, []);

  return theme;
}

type Props = {
  onAction?: (action: ToolbarAction) => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
};

export function BottomToolbar({ onAction, onToggleSidebar, isSidebarOpen = true }: Props) {
  const currentTheme = useCurrentTheme();
  const isLight = LIGHT_THEMES.includes(currentTheme);

  function toggleLightDark() {
    const next: Theme = isLight ? "dark" : "light";
    const updated = saveAppearanceSettings({ theme: next });
    applyAppearanceToDOM(updated);
  }

  return (
    <div className="flex shrink-0 items-end justify-between gap-2 border-t border-sidebar-border px-2 py-1.5">
      <div className="flex items-center gap-1">
      {TOOLBAR_ITEMS.map(function (item) {
        if (item.id === "changelog") {
          return (
            <Popover key={item.id}>
              <PopoverTrigger asChild>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      What's new (v{CURRENT_VERSION})
                    </TooltipContent>
                  </Tooltip>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="end"
                sideOffset={16}
                className="w-[min(420px,calc(100vw-1rem))] p-0 mb-2 ml-2 overflow-hidden"
                style={{
                  maxHeight:
                    "min(calc(100vh - 1rem), var(--radix-popover-content-available-height), 640px)",
                }}
              >
                <ChangelogPanel />
              </PopoverContent>
            </Popover>
          );
        }

        if (item.id === "project-info") {
          return (
            <Popover key={item.id}>
              <PopoverTrigger asChild>
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
                className="w-[min(340px,calc(100vw-1rem))] p-0 mb-2 ml-2"
              >
                <ProjectInfoPanel />
              </PopoverContent>
            </Popover>
          );
        }

        if (item.id === "theme") {
          return (
            <Popover key={item.id}>
              <div className="group/theme relative flex items-center max-md:ml-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      onClick={toggleLightDark}
                    >
                      {isLight ? (
                        <Moon className="h-4 w-4" />
                      ) : (
                        <Sun className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {isLight ? "Switch to dark" : "Switch to light"}
                  </TooltipContent>
                </Tooltip>
                <PopoverTrigger asChild>
                  <button
                    className="absolute -left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-sidebar-accent border border-sidebar-border text-muted-foreground opacity-0 scale-75 max-md:opacity-100 max-md:scale-100 group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-150 hover:text-sidebar-foreground hover:bg-muted z-10"
                    aria-label="All themes"
                  >
                    <ChevronRight className="h-2.5 w-2.5 rotate-180" />
                  </button>
                </PopoverTrigger>
              </div>
              <PopoverContent
                side="right"
                align="end"
                sideOffset={20}
                className="w-[min(520px,calc(100vw-1rem))] p-0 mb-2 ml-2"
              >
                <AppearancePanel />
              </PopoverContent>
            </Popover>
          );
        }

        return null;
      })}
      </div>

      <div className="flex flex-col items-center gap-1">
        {onToggleSidebar && (
          <SidebarPanelToggle isOpen={isSidebarOpen} onToggle={onToggleSidebar} />
        )}
        {onToggleSidebar && (
          <div className="h-px w-5 bg-sidebar-border" role="separator" aria-orientation="horizontal" />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={function () {
                onAction?.("settings");
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Settings
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export type { ToolbarAction, Theme };
