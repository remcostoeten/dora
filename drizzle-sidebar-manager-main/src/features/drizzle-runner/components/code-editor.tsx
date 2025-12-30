import { useRef, useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: () => void;
    isExecuting: boolean;
};

// Simple syntax highlighting for Drizzle ORM code
function highlightSyntax(code: string): string {
    // Keywords
    const keywords = ["from", "select", "where", "limit", "orderBy", "groupBy", "insert", "update", "delete", "set", "values"];
    const methods = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "ilike", "isNull", "isNotNull", "inArray", "notInArray", "between", "and", "or", "not", "asc", "desc"];

    let highlighted = code
        // Escape HTML
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Comments
        .replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground/60">$1</span>')
        // Strings
        .replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>')
        // Numbers
        .replace(/\b(\d+)\b/g, '<span class="text-orange-400">$1</span>')
        // db object
        .replace(/\b(db)\./g, '<span class="text-blue-400">$1</span>.');

    // Highlight keywords
    keywords.forEach((kw) => {
        const regex = new RegExp(`\\.${kw}\\(`, "g");
        highlighted = highlighted.replace(regex, `.<span class="text-purple-400">${kw}</span>(`);
    });

    // Highlight methods
    methods.forEach((method) => {
        const regex = new RegExp(`\\b(${method})\\(`, "g");
        highlighted = highlighted.replace(regex, '<span class="text-yellow-400">$1</span>(');
    });

    return highlighted;
}

export function CodeEditor({ value, onChange, onExecute, isExecuting }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const [lineNumbers, setLineNumbers] = useState<number[]>([1]);

    // Calculate line numbers
    useEffect(() => {
        const lines = value.split("\n").length;
        setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
    }, [value]);

    // Sync scroll between textarea and highlighted code
    const handleScroll = useCallback(() => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    // Handle tab key for indentation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newValue = value.substring(0, start) + "  " + value.substring(end);
            onChange(newValue);
            // Set cursor position after the inserted tab
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

    return (
        <div className="relative flex h-full bg-background font-mono text-sm">
            {/* Line numbers */}
            <div className="flex flex-col items-end py-3 px-2 text-muted-foreground/50 text-xs select-none bg-sidebar-accent/30 border-r border-sidebar-border min-w-[40px]">
                {lineNumbers.map((num) => (
                    <div key={num} className="leading-6 h-6 flex items-center">
                        {num === 1 ? (
                            <button
                                className={cn(
                                    "w-5 h-5 flex items-center justify-center rounded hover:bg-sidebar-accent transition-colors mr-1",
                                    isExecuting && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={onExecute}
                                disabled={isExecuting}
                                title="Run query (Ctrl+Enter)"
                            >
                                <Play className="h-3 w-3 text-green-400 fill-green-400" />
                            </button>
                        ) : (
                            <span className="mr-1">{num}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Editor area */}
            <div className="relative flex-1 overflow-hidden">
                {/* Highlighted code (background) */}
                <pre
                    ref={preRef}
                    className="absolute inset-0 p-3 overflow-auto pointer-events-none whitespace-pre-wrap break-words leading-6"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(value) + "\n" }}
                />

                {/* Textarea (transparent, on top) */}
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
