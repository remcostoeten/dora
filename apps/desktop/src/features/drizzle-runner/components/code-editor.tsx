import { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
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
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<any>(null); // To access monaco instance later if needed

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

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
            typeRoots: ["node_modules/@types"]
        });

        // Generate and inject simplified Drizzle types
        const drizzleTypes = generateDrizzleTypes(tables);
        const libUri = "ts:filename/drizzle.d.ts";
        monaco.languages.typescript.typescriptDefaults.addExtraLib(drizzleTypes, libUri);

        // Register custom completion provider for Drizzle-specific snippets
        // This provides beginner-friendly autocompletion at every step
        monaco.languages.registerCompletionItemProvider("typescript", {
            triggerCharacters: [".", "(", ","],
            provideCompletionItems: (model, position) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                const lineText = model.getValueInRange({
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

                const tableNames = tables.map(t => t.name);

                // After "db." (potentially with partial text like "db.sel")
                const dbMatch = lineText.match(/db\.([a-zA-Z0-9_]*)$/);
                if (dbMatch) {
                    const range = {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column - dbMatch[1].length,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    };

                    return {
                        suggestions: [
                            {
                                label: "select",
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: "select().",
                                detail: "Start a SELECT query",
                                documentation: "Usage: db.select().from(tableName)",
                                sortText: "!", // Priority over properties
                                range
                            },
                            {
                                label: "selectDistinct",
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: "selectDistinct().",
                                detail: "Start a SELECT DISTINCT query",
                                documentation: "Usage: db.selectDistinct().from(tableName)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                sortText: "!",
                                range
                            },
                            { label: "insert", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "insert(${1:table}).", detail: "Start an INSERT query", documentation: "Usage: db.insert(tableName).values({...})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "!" },
                            { label: "update", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "update(${1:table}).", detail: "Start an UPDATE query", documentation: "Usage: db.update(tableName).set({...})", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "!" },
                            { label: "delete", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "delete(${1:table})", detail: "Start a DELETE query", documentation: "Usage: db.delete(tableName).where(...)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "!" },
                            { label: "transaction", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "transaction(async (tx) => {\n\t$0\n})", detail: "Start a Transaction", documentation: "Usage: db.transaction(async (tx) => ...)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "!" },
                            { label: "execute", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "execute(sql`${1:SELECT * FROM table}`)", detail: "Execute raw SQL", documentation: "Usage: db.execute(sql`...`)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "!" },
                        ]
                    };
                }

                // After ".select()." - suggest QueryBuilder methods
                if (/\.(select|from|where|limit|offset|orderBy|groupBy|having|leftJoin|rightJoin|innerJoin|fullJoin|returning|prepare|execute|toSQL)\([^)]*\)\.$/.test(lineText)) {
                    return {
                        suggestions: [
                            { label: "from", kind: monaco.languages.CompletionItemKind.Method, insertText: "from(${1:table})", detail: "Specify table", documentation: "Example: .from(customers)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "0" },
                            { label: "where", kind: monaco.languages.CompletionItemKind.Method, insertText: "where(${1:condition})", detail: "Add WHERE condition", documentation: "Example: .where(eq(customers.id, 1))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "1" },
                            { label: "limit", kind: monaco.languages.CompletionItemKind.Method, insertText: "limit(${1:10})", detail: "Limit results", documentation: "Example: .limit(10)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "2" },
                            { label: "offset", kind: monaco.languages.CompletionItemKind.Method, insertText: "offset(${1:0})", detail: "Skip N results", documentation: "Example: .offset(20)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "3" },
                            { label: "orderBy", kind: monaco.languages.CompletionItemKind.Method, insertText: "orderBy(${1:column})", detail: "Sort results", documentation: "Example: .orderBy(desc(customers.created_at))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "4" },
                            { label: "groupBy", kind: monaco.languages.CompletionItemKind.Method, insertText: "groupBy(${1:column})", detail: "Group results", documentation: "Example: .groupBy(customers.country)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "5" },
                            { label: "having", kind: monaco.languages.CompletionItemKind.Method, insertText: "having(${1:condition})", detail: "Add HAVING condition", documentation: "Example: .having(gt(count(), 5))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "6" },
                            { label: "leftJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "leftJoin(${1:table}, ${2:condition})", detail: "LEFT JOIN", documentation: "Example: .leftJoin(orders, eq(customers.id, orders.customer_id))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "7" },
                            { label: "innerJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "innerJoin(${1:table}, ${2:condition})", detail: "INNER JOIN", documentation: "Example: .innerJoin(orders, eq(customers.id, orders.customer_id))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "8" },
                            { label: "rightJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "rightJoin(${1:table}, ${2:condition})", detail: "RIGHT JOIN", documentation: "Example: .rightJoin(orders, eq(customers.id, orders.customer_id))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "9" },
                            { label: "fullJoin", kind: monaco.languages.CompletionItemKind.Method, insertText: "fullJoin(${1:table}, ${2:condition})", detail: "FULL JOIN", documentation: "Example: .fullJoin(orders, eq(customers.id, orders.customer_id))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "10" },
                            { label: "returning", kind: monaco.languages.CompletionItemKind.Method, insertText: "returning()", detail: "Return columns", documentation: "Example: .returning() or .returning({ id: table.id })", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "11" },
                            { label: "execute", kind: monaco.languages.CompletionItemKind.Method, insertText: "execute()", detail: "Execute query", documentation: "Execute the built query", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "99" },
                        ]
                    };
                }

                // Inside .from( - suggest table names
                if (/\.from\(\s*$/.test(lineText)) {
                    return {
                        suggestions: tableNames.map((name, i) => ({
                            label: name,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: name,
                            detail: `Table: ${name}`,
                            documentation: `Select from the ${name} table`,
                            range,
                            sortText: String(i)
                        }))
                    };
                }

                // Inside .where( - suggest comparison operators
                if (/\.(where|having)\(\s*$/.test(lineText) || /,\s*$/.test(lineText) && (textUntilPosition.includes(".where(") || textUntilPosition.includes(".having("))) {
                    return {
                        suggestions: [
                            { label: "eq", kind: monaco.languages.CompletionItemKind.Function, insertText: "eq(${1:column}, ${2:value})", detail: "Equal: column = value", documentation: "Example: eq(customers.id, 1)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "00" },
                            { label: "ne", kind: monaco.languages.CompletionItemKind.Function, insertText: "ne(${1:column}, ${2:value})", detail: "Not equal: column != value", documentation: "Example: ne(customers.status, 'inactive')", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "01" },
                            { label: "gt", kind: monaco.languages.CompletionItemKind.Function, insertText: "gt(${1:column}, ${2:value})", detail: "Greater than: column > value", documentation: "Example: gt(orders.total, 100)", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "02" },
                            { label: "gte", kind: monaco.languages.CompletionItemKind.Function, insertText: "gte(${1:column}, ${2:value})", detail: "Greater or equal: column >= value", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "03" },
                            { label: "lt", kind: monaco.languages.CompletionItemKind.Function, insertText: "lt(${1:column}, ${2:value})", detail: "Less than: column < value", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "04" },
                            { label: "lte", kind: monaco.languages.CompletionItemKind.Function, insertText: "lte(${1:column}, ${2:value})", detail: "Less or equal: column <= value", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "05" },
                            { label: "like", kind: monaco.languages.CompletionItemKind.Function, insertText: "like(${1:column}, '${2:%pattern%}')", detail: "Pattern match: LIKE", documentation: "Example: like(customers.name, '%john%')", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "06" },
                            { label: "ilike", kind: monaco.languages.CompletionItemKind.Function, insertText: "ilike(${1:column}, '${2:%pattern%}')", detail: "Pattern match: ILIKE", documentation: "Example: ilike(customers.name, '%john%')", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "07" },
                            { label: "notLike", kind: monaco.languages.CompletionItemKind.Function, insertText: "notLike(${1:column}, '${2:%pattern%}')", detail: "NOT LIKE", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "08" },
                            { label: "between", kind: monaco.languages.CompletionItemKind.Function, insertText: "between(${1:column}, ${2:low}, ${3:high})", detail: "BETWEEN ... AND ...", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "09" },
                            { label: "isNull", kind: monaco.languages.CompletionItemKind.Function, insertText: "isNull(${1:column})", detail: "Check if NULL", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "10" },
                            { label: "isNotNull", kind: monaco.languages.CompletionItemKind.Function, insertText: "isNotNull(${1:column})", detail: "Check if NOT NULL", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "11" },
                            { label: "inArray", kind: monaco.languages.CompletionItemKind.Function, insertText: "inArray(${1:column}, [${2:values}])", detail: "Check if in array", documentation: "Example: inArray(customers.id, [1, 2, 3])", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "12" },
                            { label: "exists", kind: monaco.languages.CompletionItemKind.Function, insertText: "exists(${1:query})", detail: "EXISTS subquery", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "13" },
                            { label: "and", kind: monaco.languages.CompletionItemKind.Function, insertText: "and(${1:condition1}, ${2:condition2})", detail: "Combine with AND", documentation: "Example: and(eq(a, 1), eq(b, 2))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "14" },
                            { label: "or", kind: monaco.languages.CompletionItemKind.Function, insertText: "or(${1:condition1}, ${2:condition2})", detail: "Combine with OR", documentation: "Example: or(eq(a, 1), eq(a, 2))", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "15" },
                            { label: "sql", kind: monaco.languages.CompletionItemKind.Function, insertText: "sql`${1:raw sql}`", detail: "Raw SQL", documentation: "Example: sql`NOW()`", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "16" },
                        ]
                    };
                }

                // Inside eq(, ne(, gt(, etc. - suggest table.column
                if (/\b(eq|ne|gt|lt|gte|lte|like|ilike|notLike|isNull|isNotNull|inArray|asc|desc|between)\(\s*$/.test(lineText)) {
                    const suggestions: any[] = [];
                    tables.forEach(table => {
                        table.columns.forEach((col, i) => {
                            suggestions.push({
                                label: `${table.name}.${col.name}`,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: `${table.name}.${col.name}`,
                                detail: `${col.type}${col.nullable ? " (nullable)" : ""}`,
                                documentation: `Column ${col.name} from table ${table.name}`,
                                range,
                                sortText: String(i).padStart(3, "0")
                            });
                        });
                    });

                    // Add aggregate functions if in appropriate context (simplified check here)
                    suggestions.push({ label: "count()", kind: monaco.languages.CompletionItemKind.Function, insertText: "count()", range, sortText: "zzz" });
                    suggestions.push({ label: "sql``", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "sql`$1`", range, sortText: "zzz" });

                    return { suggestions };
                }

                // Inside .orderBy( - suggest asc/desc with columns
                if (/\.orderBy\(\s*$/.test(lineText)) {
                    return {
                        suggestions: [
                            { label: "asc", kind: monaco.languages.CompletionItemKind.Function, insertText: "asc(${1:column})", detail: "Sort ascending", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "0" },
                            { label: "desc", kind: monaco.languages.CompletionItemKind.Function, insertText: "desc(${1:column})", detail: "Sort descending", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: "1" },
                        ]
                    };
                }

                return { suggestions: [] };
            }
        });

        // Register Execute command (Ctrl/Cmd + Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
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
                    fontSize: 14,
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
