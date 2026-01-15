import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useState, useEffect } from "react";
import { PaginationState } from "../types";

type Props = {
    pagination: PaginationState;
    onPaginationChange: (pagination: PaginationState) => void;
    rowCount: number;
    totalCount: number;
    executionTime: number;
};

export function BottomStatusBar({
    pagination,
    onPaginationChange,
    rowCount,
    totalCount,
    executionTime,
}: Props) {
    const [limitInput, setLimitInput] = useState(String(pagination.limit));
    const [offsetInput, setOffsetInput] = useState(String(pagination.offset));

    useEffect(function() {
        setLimitInput(String(pagination.limit));
        setOffsetInput(String(pagination.offset));
    }, [pagination]);

    function handleLimitChange(value: string) {
        setLimitInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
            onPaginationChange({ ...pagination, limit: num });
        }
    }

    function handleOffsetChange(value: string) {
        setOffsetInput(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0) {
            onPaginationChange({ ...pagination, offset: num });
        }
    }

    function handleNextPage() {
        onPaginationChange({ ...pagination, offset: pagination.offset + pagination.limit });
    }

    function handlePrevPage() {
        const newOffset = Math.max(0, pagination.offset - pagination.limit);
        onPaginationChange({ ...pagination, offset: newOffset });
    }

    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const totalPages = Math.ceil(totalCount / pagination.limit);
    const startRow = pagination.offset + 1;
    const endRow = Math.min(pagination.offset + rowCount, totalCount);

    return (
        <div className="flex items-center justify-between h-8 px-3 bg-sidebar border-t border-sidebar-border shrink-0">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{executionTime}ms</span>
                </div>
                <div className="h-3 w-px bg-sidebar-border" />
                <span>
                    {totalCount === 0 ? (
                        "No rows"
                    ) : (
                        <>
                            Showing {startRow}-{endRow} of {totalCount.toLocaleString()} rows
                        </>
                    )}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Limit:</span>
                    <Input
                        type="number"
                        value={limitInput}
                        onChange={function(e) { handleLimitChange(e.target.value); }}
                        className="h-6 w-16 text-xs px-2 text-center"
                        title="Rows per page"
                    />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Offset:</span>
                    <Input
                        type="number"
                        value={offsetInput}
                        onChange={function(e) { handleOffsetChange(e.target.value); }}
                        className="h-6 w-16 text-xs px-2 text-center"
                        title="Starting row"
                    />
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>
                        Page {currentPage} of {totalPages || 1}
                    </span>
                </div>

                <div className="flex items-center rounded-md border border-input shadow-xs">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-none rounded-l-md border-r border-input"
                        onClick={handlePrevPage}
                        disabled={pagination.offset === 0}
                        title="Previous page"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-none rounded-r-md"
                        onClick={handleNextPage}
                        disabled={rowCount < pagination.limit}
                        title="Next page"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
