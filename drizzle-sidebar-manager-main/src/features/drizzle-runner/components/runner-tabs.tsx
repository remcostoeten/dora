import { cn } from "@/shared/utils/cn";
import { RunnerTab } from "../types";

type Props = {
    activeTab: RunnerTab;
    onTabChange: (tab: RunnerTab) => void;
};

export function RunnerTabs({ activeTab, onTabChange }: Props) {
    return (
        <div className="flex items-center gap-1 px-2">
            <button
                className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === "queries"
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => onTabChange("queries")}
            >
                queries
            </button>
            <button
                className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === "schema"
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => onTabChange("schema")}
            >
                schema
            </button>
        </div>
    );
}
