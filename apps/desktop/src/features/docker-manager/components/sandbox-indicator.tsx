import { Lock } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
    className?: string;
};

export function SandboxIndicator({ className = "" }: Props) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 ${className}`}>
                    <Lock className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-500">
                        Sandbox Mode Active
                    </span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm">
                    Only connections to local Docker containers and trusted hosts are allowed.
                    Remote database connections are blocked for safety.
                </p>
            </TooltipContent>
        </Tooltip>
    );
}
