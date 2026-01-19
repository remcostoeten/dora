import type { LucideIcon } from "lucide-react";

export type SidebarVariant = "default" | "floating";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string | number;
}

export interface SidebarState {
  variant: SidebarVariant;
  activeItemId: string | null;
  isPanelOpen: boolean;
}

export interface SidebarContextValue extends SidebarState {
  setVariant: (variant: SidebarVariant) => void;
  setActiveItemId: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}
