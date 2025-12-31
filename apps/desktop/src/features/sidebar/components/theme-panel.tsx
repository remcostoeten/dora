import { Monitor, Moon, Sun, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";

type Theme = "dark" | "light" | "system" | "bordered";

type ThemeOption = {
  value: Theme;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "bordered", icon: Square, label: "Bordered" },
];

type Props = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export function ThemePanel({ theme, onThemeChange }: Props) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-sidebar-foreground mb-3">Theme</h3>
      <div className="flex flex-col gap-1">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = theme === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={`w-full justify-start gap-2 ${isActive ? "bg-sidebar-accent text-sidebar-foreground" : ""}`}
              onClick={() => onThemeChange(option.value)}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
