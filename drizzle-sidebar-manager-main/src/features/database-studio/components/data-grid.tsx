import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";
import { ColumnDefinition } from "../types";

type Props = {
    columns: ColumnDefinition[];
    rows: Record<string, unknown>[];
    selectedRows: Set<number>;
    onRowSelect: (rowIndex: number, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
};

export function DataGrid({ columns, rows, selectedRows, onRowSelect, onSelectAll }: Props) {
    const allSelected = rows.length > 0 && selectedRows.size === rows.length;
    const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length;

    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No columns found for this table
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-sidebar z-10">
                    <tr>
                        {/* Checkbox column */}
                        <th className="w-10 px-3 py-2 text-center border-b border-r border-sidebar-border bg-sidebar-accent/50">
                            <Checkbox
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={(checked) => onSelectAll(!!checked)}
                                className="h-4 w-4"
                            />
                        </th>
                        {/* Data columns */}
                        {columns.map((col) => (
                            <th
                                key={col.name}
                                className="px-3 py-2 text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 whitespace-nowrap h-9"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sidebar-foreground text-xs">{col.name}</span>
                                    <span className="text-muted-foreground/50 text-[10px] font-normal font-mono lowercase">
                                        {col.type}
                                    </span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className={cn(
                                "transition-colors",
                                selectedRows.has(rowIndex)
                                    ? "bg-primary/10"
                                    : "hover:bg-sidebar-accent/30"
                            )}
                        >
                            <td className="px-3 py-1.5 text-center border-b border-r border-sidebar-border">
                                <Checkbox
                                    checked={selectedRows.has(rowIndex)}
                                    onCheckedChange={(checked) => onRowSelect(rowIndex, !!checked)}
                                    className="h-4 w-4"
                                />
                            </td>
                            {columns.map((col) => (
                                <td
                                    key={col.name}
                                    className="px-3 py-1.5 border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm whitespace-nowrap"
                                >
                                    {formatCellValue(row[col.name], col)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </ScrollArea>
    );
}

function formatCellValue(value: unknown, column: ColumnDefinition): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">NULL</span>;
    }

    if (typeof value === "boolean") {
        return (
            <span className={value ? "text-green-400" : "text-red-400"}>
                {value ? "true" : "false"}
            </span>
        );
    }

    if (typeof value === "number") {
        return <span className="text-blue-400">{value}</span>;
    }

    if (typeof value === "object") {
        return <span className="text-orange-400">{JSON.stringify(value)}</span>;
    }

    return <span className="text-sidebar-foreground">{String(value)}</span>;
}
