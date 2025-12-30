import { useRef, useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: (sql?: string) => void;
    isExecuting: boolean;
};

// SQL syntax highlighting
function highlightSql(code: string): string {
    const keywords = [
        "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
        "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET", "AS", "ON",
        "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS",
        "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
        "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW",
        "NULL", "TRUE", "FALSE", "IS", "ASC", "DESC", "DISTINCT", "ALL",
        "CASE", "WHEN", "THEN", "ELSE", "END", "UNION", "EXCEPT", "INTERSECT",
    ];

    const functions = [
        "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF",
        "CONCAT", "SUBSTRING", "LENGTH", "UPPER", "LOWER", "TRIM",
        "NOW", "DATE", "YEAR", "MONTH", "DAY",
    ];

    let highlighted = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Comments
        .replace(/(--.*$)/gm, '<span class="text-muted-foreground/60 italic">$1</span>')
        // Strings
        .replace(/('[^']*')/g, '<span class="text-green-400">$1</span>')
        // Numbers
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');

    // Highlight keywords (case-insensitive)
    keywords.forEach((kw) => {
        const regex = new RegExp(`\\b(${kw})\\b`, "gi");
        highlighted = highlighted.replace(regex, '<span class="text-blue-400 font-medium">$1</span>');
    });

    // Highlight functions
    functions.forEach((fn) => {
        const regex = new RegExp(`\\b(${fn})\\s*\\(`, "gi");
        highlighted = highlighted.replace(regex, '<span class="text-purple-400">$1</span>(');
    });

    return highlighted;
}

export function SqlEditor({ value, onChange, onExecute, isExecuting }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const [lineNumbers, setLineNumbers] = useState<number[]>([1]);

    useEffect(() => {
        const lines = value.split("\n").length;
        setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
    }, [value]);

    const handleScroll = useCallback(() => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newValue = value.substring(0, start) + "  " + value.substring(end);
            onChange(newValue);
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
                }
            });
        }

        // Execute on Ctrl/Cmd + Enter
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onExecute();
        }
    };

    const handleLineExecute = (lineNum: number) => {
        const lines = value.split("\n");
        const statement = lines[lineNum - 1]?.trim();
        if (statement && !statement.startsWith("--")) {
            onExecute(statement);
        }
    };

    return (
        <div className="relative flex h-full bg-background font-mono text-sm">
            {/* Line numbers with play buttons */}
            <div className="flex flex-col py-3 px-1 text-muted-foreground/50 text-xs select-none bg-sidebar-accent/30 border-r border-sidebar-border min-w-[50px]">
                {lineNumbers.map((num) => {
                    const line = value.split("\n")[num - 1]?.trim() || "";
                    const isExecutable = line && !line.startsWith("--");

                    return (
                        <div key={num} className="leading-6 h-6 flex items-center justify-end pr-1 group">
                            {isExecutable ? (
                                <button
                                    className={cn(
                                        "w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent transition-all",
                                        isExecuting && "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={() => handleLineExecute(num)}
                                    disabled={isExecuting}
                                    title={`Run line ${num}`}
                                >
                                    <Play className="h-3 w-3 text-green-400 fill-green-400" />
                                </button>
                            ) : (
                                <span className="w-5 text-right">{num}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Editor area */}
            <div className="relative flex-1 overflow-hidden">
                <pre
                    ref={preRef}
                    className="absolute inset-0 p-3 overflow-auto pointer-events-none whitespace-pre-wrap break-words leading-6"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: highlightSql(value) + "\n" }}
                />
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    className="absolute inset-0 p-3 resize-none bg-transparent text-transparent caret-white outline-none leading-6 overflow-auto"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                />
            </div>
        </div>
    );
}
