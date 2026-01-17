import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { cn } from "@/shared/utils/cn";
import { Badge } from "@/shared/ui/badge";
import type { ReactNode } from "react";

export function SidebarPanel({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("flex flex-col", className)}>{children}</div>;
}

type SidebarPanelHeaderProps = {
    title: string;
    version?: string;
    children?: ReactNode;
    className?: string;
};

export function SidebarPanelHeader({ title, version, children, className }: SidebarPanelHeaderProps) {
    return (
        <>
            <div className={cn("flex items-center justify-between px-4 py-2", className)}>
                <h3 className="text-sm font-medium text-sidebar-foreground">{title}</h3>
                {version && (
                    <Badge variant="outline" className="text-xs font-mono">
                        v{version}
                    </Badge>
                )}
                {children}
            </div>
            <Separator className="bg-sidebar-border" />
        </>
    );
}

type SidebarPanelContentProps = {
    children: ReactNode;
    className?: string;
    maxHeight?: number | string;
};

export function SidebarPanelContent({ children, className, maxHeight }: SidebarPanelContentProps) {
    return (
        <ScrollArea className={cn("flex-1", className)} style={{ maxHeight: maxHeight || undefined }}>
            {children}
        </ScrollArea>
    );
}

type SidebarSectionProps = {
    title?: string;
    children: ReactNode;
    className?: string;
    separator?: boolean;
};

export function SidebarSection({ title, children, className, separator = true }: SidebarSectionProps) {
    return (
        <>
            <div className={cn("space-y-2", className)}>
                {title && (
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {title}
                    </h4>
                )}
                {children}
            </div>
            {separator && <Separator className="bg-sidebar-border/50 my-4" />}
        </>
    );
}
