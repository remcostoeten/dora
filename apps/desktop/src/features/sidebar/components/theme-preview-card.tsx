import { Check } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Props = {
  name: string;
  isSelected: boolean;
  onClick: () => void;
  variant: "dark" | "light";
  accentColor: string;
};

export function ThemePreviewCard({
  name,
  isSelected,
  onClick,
  variant,
  accentColor,
}: Props) {
  const isDark = variant === "dark";

  function ActivePulseBorder() {
    return (
      <div className="absolute inset-0 w-full h-full rounded-lg animate-pulse">
        <div className="w-full h-full rounded-lg bg-primary/10" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 flex flex-col rounded-lg transition-all cursor-pointer overflow-hidden w-full",
        "hover:opacity-90",
        isSelected && "ring-1 ring-border/60 ring-offset-1 ring-offset-sidebar  relative ",
      )}
    >
      <div
        className={cn(
          "w-full aspect-[3/2] rounded-lg overflow-hidden relative",
          isDark ? "bg-[#1a1a1a]" : "bg-[#f0f0f0]"
        )}
      >
        {isSelected && <ActivePulseBorder />}
        <div className="flex items-center gap-1 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
        </div>

        <div className="flex h-[calc(100%-18px)]">
          <div
            className={cn(
              "w-[28px] flex flex-col gap-1 p-1",
              isDark ? "bg-[#0d0d0d]" : "bg-[#e5e5e5]"
            )}
          >
            <div
              className="h-2 w-full rounded-sm"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className={cn(
                "h-1.5 w-3/4 rounded-sm",
                isDark ? "bg-[#3a3a3a]" : "bg-[#c8c8c8]"
              )}
            />
            <div
              className={cn(
                "h-1.5 w-full rounded-sm",
                isDark ? "bg-[#3a3a3a]" : "bg-[#c8c8c8]"
              )}
            />
          </div>

          <div className="flex-1 p-1.5 flex flex-col gap-1">
            <div className="flex gap-1">
              <div
                className="h-1.5 w-6 rounded-sm"
                style={{ backgroundColor: accentColor }}
              />
              <div
                className={cn(
                  "h-1.5 w-4 rounded-sm",
                  isDark ? "bg-[#3a3a3a]" : "bg-[#c8c8c8]"
                )}
              />
            </div>
            <div
              className={cn(
                "h-1.5 w-full rounded-sm",
                isDark ? "bg-[#2a2a2a]" : "bg-[#d8d8d8]"
              )}
            />
            <div
              className={cn(
                "h-1.5 w-4/5 rounded-sm",
                isDark ? "bg-[#2a2a2a]" : "bg-[#d8d8d8]"
              )}
            />
            <div className="flex items-center gap-0.5 mt-auto">
              <div
                className={cn(
                  "w-1 h-1 rounded-full",
                  isDark ? "bg-[#444]" : "bg-[#bbb]"
                )}
              />
              <div
                className="h-1.5 w-8 rounded-sm"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-primary">
            <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />
          </div>
        )}
      </div>

      <span className="text-[11px] font-medium text-sidebar-foreground mt-1.5 px-0.5">
        {name}
      </span>
    </button>
  );
}
