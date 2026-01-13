import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ThemePreviewCard } from "./theme-preview-card";
import { cn } from "@/shared/utils/cn";

type Theme = "dark" | "light";

type ThemeConfig = {
  value: Theme;
  name: string;
  variant: "dark" | "light";
  accentColor: string;
};

const THEME_OPTIONS: ThemeConfig[] = [
  { value: "dark", name: "Dark", variant: "dark", accentColor: "#e5e5e5" },
  { value: "light", name: "Light", variant: "light", accentColor: "#171717" },
];

type Props = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export function ThemePanel({ theme, onThemeChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateScrollButtons() {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const scrollAmount = 140;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateScrollButtons, 300);
  }

  return (
    <div className="p-4 pt-5">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-sidebar-foreground">
            Choose Your Theme
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick a theme to change the look
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              !canScrollLeft && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              !canScrollRight && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
      >
        {THEME_OPTIONS.map((option) => (
          <ThemePreviewCard
            key={option.value}
            name={option.name}
            isSelected={theme === option.value}
            onClick={() => onThemeChange(option.value)}
            variant={option.variant}
            accentColor={option.accentColor}
          />
        ))}
      </div>
    </div>
  );
}
