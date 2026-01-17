import { ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

export type StudioDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    className?: string; // For DialogContent override
    contentClassName?: string; // For inner content wrapper
};

export function StudioDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    className,
    contentClassName,
}: StudioDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("sm:max-w-[425px]", className)}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <div className={cn("py-4", contentClassName)}>
                    {children}
                </div>

                {footer && <DialogFooter>{footer}</DialogFooter>}
            </DialogContent>
        </Dialog>
    );
}
