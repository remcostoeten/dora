import { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useSetting } from "@/core/settings";
import { generateDrizzleTypes } from "../utils/lsp-utils";
import { SchemaTable } from "../types";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: (code?: string) => void;
    isExecuting: boolean;
    tables: SchemaTable[];
};

export function CodeEditor({ value, onChange, onExecute, isExecuting, tables }: Props) {
    const { theme } = useTheme();
    const [editorFontSize] = useSetting("editorFontSize");
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<any>(null); // To access monaco instance later if needed

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Use standard VS Dark theme for TypeScript to differentiate from SQL Console
        // (SQL Console uses Pink/Green Drizzle style)
        monaco.editor.setTheme("vs-dark");

        // Compiler options for better intellisense
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            strict: true, // Enable strict mode for better type checking
            noImplicitAny: true,
            typeRoots: ["node_modules/@types"]
        });

        // Generate and inject simplified Drizzle types
        const drizzleTypes = generateDrizzleTypes(tables);
        // Using a "real" file path helps Monaco resolve it better
        const libUri = "file:///drizzle.d.ts";
        monaco.languages.typescript.typescriptDefaults.addExtraLib(drizzleTypes, libUri);

        // Force the model to use the types
        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, "typescript");
        }

        monaco.languages.registerCompletionItemProvider("typescript", {
            triggerCharacters: ["."],
            provideCompletionItems: function (model, position) {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                const range = {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                };

                if (/db\.$/.test(textUntilPosition)) {
                    return {
                        suggestions: [
                            { label: "select", kind: monaco.languages.CompletionItemKind.Method, insertText: "select()", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Start a SELECT query", documentation: "Chain with .from(table)", range, sortText: "0", command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" } },
                            { label: "insert", kind: monaco.languages.CompletionItemKind.Method, insertText: "insert(${1:table})$0", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Start an INSERT query", documentation: "Pass a table: db.insert(users)", range, sortText: "1" },
                            { label: "update", kind: monaco.languages.CompletionItemKind.Method, insertText: "update(${1:table})$0", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Start an UPDATE query", documentation: "Pass a table: db.update(users)", range, sortText: "2" },
                            { label: "delete", kind: monaco.languages.CompletionItemKind.Method, insertText: "delete(${1:table})$0", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Start a DELETE query", documentation: "Pass a table: db.delete(users)", range, sortText: "3" },
                            { label: "execute", kind: monaco.languages.CompletionItemKind.Method, insertText: "execute(sql`${1:query}`)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Execute raw SQL", range, sortText: "4" },
                        ]
                    };
                }

                const selectChainMatch = textUntilPosition.match(/\.select\([^)]*\)\.$|select\(\)\.$|\.from\([^)]+\)\.$|\.where\([^)]*\)\.$|\.orderBy\([^)]*\)\.$|\.groupBy\([^)]*\)\.$|\.limit\(\d*\)\.$|\.offset\(\d*\)\.$/);
                if (selectChainMatch) {
                    const hasFrom = /\.from\(/.test(textUntilPosition);
                    const hasWhere = /\.where\(/.test(textUntilPosition);

                    const suggestions: any[] = [];

                    if (!hasFrom) {
                        suggestions.push({
                            label: "from",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "from(${1:table})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Specify the table to select from",
                            documentation: "Chain: .from(users)",
                            range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        });
                    }

                    if (hasFrom && !hasWhere) {
                        suggestions.push({
                            label: "where",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "where(${1:condition})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Filter results",
                            documentation: "Use eq(), gt(), etc.",
                            range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        });
                    }

                    if (hasFrom) {
                        suggestions.push(
                            { label: "orderBy", kind: monaco.languages.CompletionItemKind.Method, insertText: "orderBy(${1:column})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Order results", range, sortText: "1", command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" } },
                            { label: "groupBy", kind: monaco.languages.CompletionItemKind.Method, insertText: "groupBy(${1:column})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Group results", range, sortText: "2", command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" } },
                            { label: "limit", kind: monaco.languages.CompletionItemKind.Method, insertText: "limit(${1:10})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Limit rows", range, sortText: "3" },
                            { label: "offset", kind: monaco.languages.CompletionItemKind.Method, insertText: "offset(${1:0})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Offset rows", range, sortText: "4" },
                            { label: "leftJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "leftJoin(${1:table}, ${2:condition})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Left join table", range, sortText: "5" },
                            { label: "innerJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "innerJoin(${1:table}, ${2:condition})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Inner join table", range, sortText: "6" },
                            { label: "execute", kind: monaco.languages.CompletionItemKind.Method, insertText: "execute()", detail: "Execute query", range, sortText: "9" }
                        );
                    }

                    return { suggestions };
                }

                const fromMatch = textUntilPosition.match(/\.from\(\s*$/);
                if (fromMatch) {
                    return {
                        suggestions: tables.map(function (t, i) {
                            return {
                                label: t.name,
                                kind: monaco.languages.CompletionItemKind.Variable,
                                insertText: t.name + ")",
                                detail: "Table: " + t.name + " (" + t.columns.length + " columns)",
                                range: range,
                                sortText: String(i),
                                command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                            };
                        })
                    };
                }

                const whereMatch = textUntilPosition.match(/\.where\(\s*$/);
                if (whereMatch) {
                    return {
                        suggestions: [
                            { label: "eq", kind: monaco.languages.CompletionItemKind.Function, insertText: "eq($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Equal: column = value", range, sortText: "0" },
                            { label: "ne", kind: monaco.languages.CompletionItemKind.Function, insertText: "ne($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Not equal", range, sortText: "1" },
                            { label: "gt", kind: monaco.languages.CompletionItemKind.Function, insertText: "gt($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Greater than", range, sortText: "2" },
                            { label: "lt", kind: monaco.languages.CompletionItemKind.Function, insertText: "lt($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Less than", range, sortText: "3" },
                            { label: "gte", kind: monaco.languages.CompletionItemKind.Function, insertText: "gte($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Greater or equal", range, sortText: "4" },
                            { label: "lte", kind: monaco.languages.CompletionItemKind.Function, insertText: "lte($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Less or equal", range, sortText: "5" },
                            { label: "like", kind: monaco.languages.CompletionItemKind.Function, insertText: "like($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "LIKE pattern match", range, sortText: "6" },
                            { label: "and", kind: monaco.languages.CompletionItemKind.Function, insertText: "and($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Combine with AND", range, sortText: "7" },
                            { label: "or", kind: monaco.languages.CompletionItemKind.Function, insertText: "or($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Combine with OR", range, sortText: "8" },
                            { label: "isNull", kind: monaco.languages.CompletionItemKind.Function, insertText: "isNull($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Check if NULL", range, sortText: "9" },
                            { label: "isNotNull", kind: monaco.languages.CompletionItemKind.Function, insertText: "isNotNull($0)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: "Check if NOT NULL", range, sortText: "10" },
                        ]
                    };
                }

                const helperMatch = textUntilPosition.match(/\b(eq|ne|gt|lt|gte|lte|like|ilike|inArray|isNull|isNotNull|asc|desc)\(\s*$/);
                if (helperMatch) {
                    const suggestions: any[] = [];
                    tables.forEach(function (table) {
                        table.columns.forEach(function (col, i) {
                            suggestions.push({
                                label: table.name + "." + col.name,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: table.name + "." + col.name,
                                detail: col.type + (col.nullable ? " (nullable)" : ""),
                                range: range,
                                sortText: String(i).padStart(3, "0")
                            });
                        });
                    });
                    return { suggestions: suggestions };
                }

                return { suggestions: [] };
            }
        });

        // Register Execute command (Ctrl/Cmd + Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
            triggerExecution(editor);
        });

        // Add a "mif largin/glyph" click listener
        editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber) {
                    const model = editor.getModel();
                    if (model) {
                        const content = model.getLineContent(lineNumber);
                        if (content && content.trim()) {
                            onExecute(content);
                        }
                    }
                }
            }
        });

        updateDecorations(editor, monaco);
    };

    // Update decorations whenever content changes
    useEffect(() => {
        if (editorRef.current && monacoRef.current) {
            updateDecorations(editorRef.current, monacoRef.current);
        }
    }, [value]);

    const updateDecorations = (editor: any, monaco: any) => {
        const model = editor.getModel();
        if (!model) return;

        const lineCount = model.getLineCount();
        const newDecorations: any[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const content = model.getLineContent(i).trim();
            // Show run button for non-empty lines
            if (content.length > 0 && !content.startsWith("//") && !content.startsWith("/*")) {
                newDecorations.push({
                    range: new monaco.Range(i, 1, i, 1),
                    options: {
                        isWholeLine: false,
                        glyphMarginClassName: "run-glyph-margin",
                        glyphMarginHoverMessage: { value: "Run Line" }
                    }
                });
            }
        }

        const previousDecorations = (editor as any)._previousDecorations || [];
        (editor as any)._previousDecorations = editor.deltaDecorations(previousDecorations, newDecorations);
    };

    const triggerExecution = (editor: any) => {
        const selection = editor.getSelection();
        const model = editor.getModel();

        if (!selection || !model) return;

        let codeToRun = "";

        if (!selection.isEmpty()) {
            codeToRun = model.getValueInRange(selection);
        } else {
            const position = editor.getPosition();
            if (position) {
                codeToRun = model.getLineContent(position.lineNumber);
            }
        }

        if (codeToRun.trim()) {
            onExecute(codeToRun);
        }
    };

    return (
        <div className="h-full w-full overflow-hidden pt-2 relative group">
            {/* Inject global styles for the glyph margin icon */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .run-glyph-margin {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981' stroke='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='5 3 19 12 5 21 5 3'/%3E%3C/svg%3E");
                    background-size: 12px 12px;
                    background-repeat: no-repeat;
                    background-position: center;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }
                .run-glyph-margin:hover {
                    opacity: 1;
                }
             `}} />

            <Editor
                height="100%"
                defaultLanguage="typescript"
                value={value}
                onChange={(newValue) => onChange(newValue || "")}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    fontSize: editorFontSize,
                    lineNumbers: "on",
                    glyphMargin: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordBasedSuggestions: "off",
                    readOnly: isExecuting,
                    padding: { top: 10, bottom: 10 },
                    renderLineHighlight: "all",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}
            />
        </div>
    );
}
