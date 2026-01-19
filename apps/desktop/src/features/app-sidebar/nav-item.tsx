import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavItem } from "./types";

const navItemVariants = cva(
  [
    "relative flex items-center justify-center transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
    "disabled:pointer-events-none disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        default: "rounded-md",
        floating: "rounded-xl",
      },
      size: {
        default: "h-10 w-10",
        sm: "h-8 w-8",
        lg: "h-12 w-12",
      },
      state: {
        default:
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active: "bg-sidebar-primary text-sidebar-primary-foreground",
        disabled: "cursor-not-allowed opacity-40",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      state: "default",
    },
  }
);

export interface NavItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    VariantProps<typeof navItemVariants> {
  item: NavItem;
  isActive?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export const SidebarNavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  function SidebarNavItem(
    {
      item,
      isActive = false,
      variant = "default",
      size = "default",
      tooltipSide = "right",
      className,
      ...props
    },
    ref
  ) {
    const Icon = item.icon;
    const state = item.disabled ? "disabled" : isActive ? "active" : "default";

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            role="menuitem"
            tabIndex={item.disabled ? -1 : 0}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(navItemVariants({ variant, size, state }), className)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            aria-disabled={item.disabled}
            {...props}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{item.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          {item.label}
          {item.disabled && " (Coming Soon)"}
        </TooltipContent>
      </Tooltip>
    );
  }
);
