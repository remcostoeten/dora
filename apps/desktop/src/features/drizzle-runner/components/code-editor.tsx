import { useRef, useEffect, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useSetting } from "@/core/settings";
import { generateDrizzleTypes } from "../utils/lsp-utils";
import { SchemaColumn, SchemaTable } from "../types";
import { loadTheme, isBuiltinTheme, MonacoTheme } from "@/core/settings/editor-themes";
import { initVimMode } from "monaco-vim";
import type { VimAdapterInstance } from "monaco-vim";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: (code?: string) => void;
    isExecuting: boolean;
    tables: SchemaTable[];
};

type EditorRef = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];
type Suggestion = Monaco.languages.CompletionItem;
type SuggestList = Monaco.languages.CompletionList;
type TextRange = Monaco.IRange;
type TypeKind = "number" | "string" | "boolean" | "date" | "unknown";

function getTypeKind(columnType: string): TypeKind {
    if (/int|serial|decimal|double|float|numeric|real/.test(columnType)) {
        return "number";
    }
    if (/char|text|uuid|json|enum/.test(columnType)) {
        return "string";
    }
    if (/bool/.test(columnType)) {
        return "boolean";
    }
    if (/timestamp|date|time/.test(columnType)) {
        return "date";
    }
    return "unknown";
}

function getValueSnippet(kind: TypeKind): string {
    if (kind === "number") return "0";
    if (kind === "string") return "\"\"";
    if (kind === "boolean") return "false";
    if (kind === "date") return "new Date()";
    return "null";
}

function getTable(tables: SchemaTable[], tableName: string): SchemaTable | undefined {
    return tables.find(function (table) {
        return table.name === tableName;
    });
}

function getColumn(table: SchemaTable, columnName: string): SchemaColumn | undefined {
    return table.columns.find(function (column) {
        return column.name === columnName;
    });
}

function getRange(monaco: MonacoApi, model: Monaco.editor.ITextModel, position: Monaco.Position): TextRange {
    const word = model.getWordUntilPosition(position);
    return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
}

function tableSnippet(table: SchemaTable): string {
    return `${table.name})$0`;
}

function valuesSnippet(table: SchemaTable, includePrimary: boolean): string {
    const columns = table.columns.filter(function (column) {
        if (includePrimary) return true;
        return !column.primaryKey;
    });
    const items = columns.map(function (column, index) {
        const value = getValueSnippet(getTypeKind(column.type));
        if (index === 0) {
            return `${column.name}: \${1:${value}}`;
        }
        return `${column.name}: ${value}`;
    });
    return `{ ${items.join(", ")} }`;
}

function shouldSuggest(text: string): boolean {
    return /[a-zA-Z0-9_.(),\s]/.test(text);
}

function getTableMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b([a-zA-Z_][\w]*)\.$/);
}

function getDbName(text: string): "db" | "tx" | null {
    const match = text.match(/\b(db|tx)\.[\w]*$/);
    if (!match) return null;
    if (match[1] === "tx") return "tx";
    return "db";
}

function getColumnMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\.$/);
}

function getValueMatch(text: string): RegExpMatchArray | null {
    return text.match(/\b(eq|ne|gt|gte|lt|lte|inArray)\(\s*([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\s*,\s*$/);
}

function getJoinMatch(text: string): RegExpMatchArray | null {
    return text.match(/\bfrom\(\s*([a-zA-Z_][\w]*)\s*\)\.[\w]*Join\(\s*([a-zA-Z_][\w]*)\s*,\s*$/);
}

function getChainMode(text: string): "select" | "insert" | "update" | "delete" | null {
    if (
        /db\.select\([^)]*\)\.$/.test(text)
        || /\.from\([^)]*\)\.$/.test(text)
        || /\.where\([^)]*\)\.$/.test(text)
        || /\.leftJoin\([^)]*\)\.$/.test(text)
        || /\.innerJoin\([^)]*\)\.$/.test(text)
        || /\.orderBy\([^)]*\)\.$/.test(text)
        || /\.limit\([^)]*\)\.$/.test(text)
    ) {
        return "select";
    }
    if (/db\.insert\([^)]*\)\.$/.test(text)) return "insert";
    if (/db\.update\([^)]*\)\.$/.test(text)) return "update";
    if (/db\.delete\([^)]*\)\.$/.test(text)) return "delete";
    return null;
}

function hasChain(text: string, name: string): boolean {
    return new RegExp(`\\.${name}\\(`).test(text);
}

function getJoinSnippet(leftTable: SchemaTable, rightTable: SchemaTable): string | null {
    const leftId = leftTable.columns.find(function (column) {
        return column.primaryKey || column.name === "id";
    });
    if (!leftId) return null;
    const rightMatch = rightTable.columns.find(function (column) {
        return column.name === `${leftTable.name}Id` || column.name === `${leftTable.name}_id`;
    });
    if (!rightMatch) return null;
    return `eq(${leftTable.name}.${leftId.name}, ${rightTable.name}.${rightMatch.name})`;
}

function buildSuggestions(range: TextRange, suggestions: Suggestion[]): SuggestList {
    return { suggestions: suggestions, incomplete: false };
}

export function CodeEditor({ value, onChange, onExecute, isExecuting, tables }: Props) {
    const [editorFontSize] = useSetting("editorFontSize");
    const [editorThemeSetting] = useSetting("editorTheme");
    const [enableVimMode] = useSetting("enableVimMode");
    const editorRef = useRef<EditorRef | null>(null);
    const monacoRef = useRef<MonacoApi | null>(null);
    const vimModeRef = useRef<VimAdapterInstance | null>(null);
    const statusBarRef = useRef<HTMLDivElement | null>(null);
    const loadedThemesRef = useRef<Set<string>>(new Set());
    const decorRef = useRef<string[]>([]);

    function getThemeFromDocument(): MonacoTheme {
        if (typeof document !== "undefined") {
            return document.documentElement.classList.contains("light") ? "vs" : "vs-dark";
        }
        return "vs-dark";
    }

    function deriveMonacoTheme(): string {
        if (editorThemeSetting === "auto") {
            return getThemeFromDocument();
        }
        if (editorThemeSetting === "light") return "vs";
        if (editorThemeSetting === "dark") return "vs-dark";
        return editorThemeSetting;
    }

    const [editorTheme, setEditorTheme] = useState<string>(deriveMonacoTheme);

    useEffect(function syncFromSetting() {
        setEditorTheme(deriveMonacoTheme());
    }, [editorThemeSetting]);

    useEffect(function observeTheme() {
        if (editorThemeSetting !== "auto") return;
        const observer = new MutationObserver(function() {
            setEditorTheme(getThemeFromDocument());
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return function() { observer.disconnect(); };
    }, [editorThemeSetting]);

    useEffect(function applyTheme() {
        if (!monacoRef.current) return;
        
        async function apply() {
            const themeName = editorTheme;
            if (!isBuiltinTheme(themeName) && !loadedThemesRef.current.has(themeName)) {
                const themeData = await loadTheme(themeName as MonacoTheme);
                if (themeData && monacoRef.current) {
                    monacoRef.current.editor.defineTheme(themeName, themeData);
                    loadedThemesRef.current.add(themeName);
                }
            }
            if (monacoRef.current) {
                monacoRef.current.editor.setTheme(themeName);
            }
        }
        apply();
    }, [editorTheme]);

    useEffect(function handleVimMode() {
        if (!editorRef.current || !statusBarRef.current) return;

        if (enableVimMode) {
            if (!vimModeRef.current) {
                vimModeRef.current = initVimMode(editorRef.current, statusBarRef.current);
            }
        } else {
            if (vimModeRef.current) {
                vimModeRef.current.dispose();
                vimModeRef.current = null;
            }
        }

        return function() {
            if (vimModeRef.current) {
                vimModeRef.current.dispose();
                vimModeRef.current = null;
            }
        };
    }, [enableVimMode]);

    const handleEditorDidMount: OnMount = function(editor, monaco) {
        editorRef.current = editor;
        monacoRef.current = monaco;

        monaco.editor.setTheme(editorTheme);

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            strict: true,
            noImplicitAny: true,
            typeRoots: ["node_modules/@types"]
        });

        const drizzleTypes = generateDrizzleTypes(tables);
        const libUri = "file:///drizzle.d.ts";
        monaco.languages.typescript.typescriptDefaults.addExtraLib(drizzleTypes, libUri);

        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, "typescript");
        }

        monaco.languages.registerCompletionItemProvider("typescript", {
            triggerCharacters: [".", "(", ",", " "],
            exclusive: true,
            provideCompletionItems: function (model, position): SuggestList {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                const range = getRange(monaco, model, position);

                const dbName = getDbName(textUntilPosition);
                if (dbName) {
                    const suggestions: Suggestion[] = [
                        {
                            label: "select",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "select($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Start a SELECT query",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "insert",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "insert($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Start an INSERT query",
                            range: range,
                            sortText: "1",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "update",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "update($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Start an UPDATE query",
                            range: range,
                            sortText: "2",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "delete",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "delete($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Start a DELETE query",
                            range: range,
                            sortText: "3",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "batch",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "batch([$0])",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Run a batch of queries",
                            range: range,
                            sortText: "4"
                        }
                    ];
                    if (dbName === "db") {
                        suggestions.splice(4, 0, {
                            label: "transaction",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "transaction(async tx => {\n  $0\n})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Run queries in a transaction",
                            range: range,
                            sortText: "4"
                        });
                        suggestions[5].sortText = "5";
                    }
                    return buildSuggestions(range, suggestions);
                }

                if (/db\.select\(\s*$/.test(textUntilPosition)) {
                    return buildSuggestions(range, tables.map(function (table, index) {
                        return {
                            label: table.name,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: tableSnippet(table),
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Table",
                            range: range,
                            sortText: String(index).padStart(3, "0"),
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        };
                    }));
                }

                if (/db\.insert\(\s*$/.test(textUntilPosition) || /db\.update\(\s*$/.test(textUntilPosition) || /db\.delete\(\s*$/.test(textUntilPosition)) {
                    return buildSuggestions(range, tables.map(function (table, index) {
                        return {
                            label: table.name,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: tableSnippet(table),
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Table",
                            range: range,
                            sortText: String(index).padStart(3, "0"),
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        };
                    }));
                }

                if (/\.from\(\s*$/.test(textUntilPosition)) {
                    return buildSuggestions(range, tables.map(function (table, index) {
                        return {
                            label: table.name,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: tableSnippet(table),
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Table",
                            range: range,
                            sortText: String(index).padStart(3, "0"),
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        };
                    }));
                }

                if (/\.leftJoin\(\s*$/.test(textUntilPosition) || /\.innerJoin\(\s*$/.test(textUntilPosition)) {
                    return buildSuggestions(range, tables.map(function (table, index) {
                        return {
                            label: table.name,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: `${table.name}, $0)`,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Join table",
                            range: range,
                            sortText: String(index).padStart(3, "0"),
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        };
                    }));
                }

                if (/\.values\(\s*$/.test(textUntilPosition)) {
                    const tableMatch = textUntilPosition.match(/db\.insert\(\s*([a-zA-Z_][\w]*)\s*\)/);
                    if (tableMatch) {
                        const table = getTable(tables, tableMatch[1]);
                        if (table) {
                            return buildSuggestions(range, [
                                {
                                    label: "values",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    insertText: `${valuesSnippet(table, true)})$0`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Insert values",
                                    range: range
                                }
                            ]);
                        }
                    }
                }

                if (/\.set\(\s*$/.test(textUntilPosition)) {
                    const tableMatch = textUntilPosition.match(/db\.update\(\s*([a-zA-Z_][\w]*)\s*\)/);
                    if (tableMatch) {
                        const table = getTable(tables, tableMatch[1]);
                        if (table) {
                            return buildSuggestions(range, [
                                {
                                    label: "set",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    insertText: `${valuesSnippet(table, false)})$0`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Update values",
                                    range: range
                                }
                            ]);
                        }
                    }
                }

                if (/\.where\(\s*$/.test(textUntilPosition)) {
                    const fromMatch = textUntilPosition.match(/\.from\(\s*([a-zA-Z_][\w]*)\s*\)/);
                    const baseSuggestions = [
                        {
                            label: "eq",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "eq(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Equal",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "ne",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "ne(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Not equal",
                            range: range,
                            sortText: "1",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "gt",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "gt(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Greater than",
                            range: range,
                            sortText: "2",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "gte",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "gte(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Greater or equal",
                            range: range,
                            sortText: "3",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "lt",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "lt(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Less than",
                            range: range,
                            sortText: "4",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "lte",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "lte(${1:column}, ${2:value})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Less or equal",
                            range: range,
                            sortText: "5",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "inArray",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "inArray(${1:column}, ${2:values})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "In array",
                            range: range,
                            sortText: "6",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "isNull",
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: "isNull(${1:column})",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Is null",
                            range: range,
                            sortText: "7",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        }
                    ];

                    if (fromMatch) {
                        const table = getTable(tables, fromMatch[1]);
                        if (table) {
                            const tableSuggestions = table.columns.map(function (column, index) {
                                return {
                                    label: `${table.name}.${column.name}`,
                                    kind: monaco.languages.CompletionItemKind.Field,
                                    insertText: `eq(${table.name}.${column.name}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Condition",
                                    range: range,
                                    sortText: `9${String(index).padStart(3, "0")}`
                                };
                            });
                            return buildSuggestions(range, baseSuggestions.concat(tableSuggestions));
                        }
                    }
                    return buildSuggestions(range, baseSuggestions);
                }

                const joinMatch = getJoinMatch(textUntilPosition);
                if (joinMatch) {
                    const leftTable = getTable(tables, joinMatch[1]);
                    const rightTable = getTable(tables, joinMatch[2]);
                    if (leftTable && rightTable) {
                        const joinSnippet = getJoinSnippet(leftTable, rightTable);
                        if (joinSnippet) {
                            return buildSuggestions(range, [
                                {
                                    label: joinSnippet,
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `${joinSnippet}$0`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Join condition",
                                    range: range
                                }
                            ]);
                        }
                    }
                }

                const helperMatch = textUntilPosition.match(/\b(eq|ne|gt|gte|lt|lte|inArray)\(\s*$/);
                if (helperMatch) {
                    const suggestions: Suggestion[] = [];
                    tables.forEach(function (table) {
                        table.columns.forEach(function (column, index) {
                            suggestions.push({
                                label: `${table.name}.${column.name}`,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: `${table.name}.${column.name}`,
                                detail: column.type,
                                range: range,
                                sortText: String(index).padStart(3, "0")
                            });
                        });
                    });
                    return buildSuggestions(range, suggestions);
                }

                const valueMatch = getValueMatch(textUntilPosition);
                if (valueMatch) {
                    const table = getTable(tables, valueMatch[2]);
                    if (table) {
                        const column = getColumn(table, valueMatch[3]);
                        if (column) {
                            const kind = getTypeKind(column.type);
                            const valueSuggestions: Suggestion[] = [];
                            if (kind === "number") {
                                valueSuggestions.push(
                                    { label: "1", kind: monaco.languages.CompletionItemKind.Value, insertText: "1", range: range, sortText: "0" },
                                    { label: "10", kind: monaco.languages.CompletionItemKind.Value, insertText: "10", range: range, sortText: "1" },
                                    { label: "100", kind: monaco.languages.CompletionItemKind.Value, insertText: "100", range: range, sortText: "2" }
                                );
                            }
                            if (kind === "string") {
                                valueSuggestions.push(
                                    { label: "\"test@example.com\"", kind: monaco.languages.CompletionItemKind.Value, insertText: "\"test@example.com\"", range: range, sortText: "0" }
                                );
                            }
                            if (kind === "boolean") {
                                valueSuggestions.push(
                                    { label: "true", kind: monaco.languages.CompletionItemKind.Value, insertText: "true", range: range, sortText: "0" },
                                    { label: "false", kind: monaco.languages.CompletionItemKind.Value, insertText: "false", range: range, sortText: "1" }
                                );
                            }
                            if (kind === "date") {
                                valueSuggestions.push(
                                    { label: "new Date()", kind: monaco.languages.CompletionItemKind.Value, insertText: "new Date()", range: range, sortText: "0" }
                                );
                            }
                            valueSuggestions.push({
                                label: "param()",
                                kind: monaco.languages.CompletionItemKind.Function,
                                insertText: "param($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Parameter",
                                range: range,
                                sortText: "9"
                            });
                            return buildSuggestions(range, valueSuggestions);
                        }
                    }
                }

                const columnMatch = getColumnMatch(textUntilPosition);
                if (columnMatch) {
                    const table = getTable(tables, columnMatch[1]);
                    if (table) {
                        const column = getColumn(table, columnMatch[2]);
                        if (column) {
                            const columnRef = `${table.name}.${column.name}`;
                            return buildSuggestions(range, [
                                {
                                    label: "eq",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `eq(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Equal",
                                    range: range,
                                    sortText: "0",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "ne",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `ne(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Not equal",
                                    range: range,
                                    sortText: "1",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "gt",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `gt(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Greater than",
                                    range: range,
                                    sortText: "2",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "gte",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `gte(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Greater or equal",
                                    range: range,
                                    sortText: "3",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "lt",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `lt(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Less than",
                                    range: range,
                                    sortText: "4",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "lte",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `lte(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Less or equal",
                                    range: range,
                                    sortText: "5",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "inArray",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `inArray(${columnRef}, $0)`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "In array",
                                    range: range,
                                    sortText: "6",
                                    command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                                },
                                {
                                    label: "isNull",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    insertText: `isNull(${columnRef})`,
                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                    detail: "Is null",
                                    range: range,
                                    sortText: "7"
                                }
                            ]);
                        }
                    }
                }

                const tableMatch = getTableMatch(textUntilPosition);
                if (tableMatch) {
                    const table = getTable(tables, tableMatch[1]);
                    if (table) {
                        return buildSuggestions(range, table.columns.map(function (column, index) {
                            return {
                                label: column.name,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: column.name,
                                detail: column.type,
                                range: range,
                                sortText: String(index).padStart(3, "0"),
                                command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                            };
                        }));
                    }
                }

                const chainMode = getChainMode(textUntilPosition);
                if (chainMode === "select") {
                    const suggestions: Suggestion[] = [];
                    const hasFrom = hasChain(textUntilPosition, "from");
                    if (!hasFrom) {
                        suggestions.push({
                            label: "from",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "from($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Select from a table",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        });
                    } else {
                        suggestions.push(
                            {
                                label: "where",
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: "where($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Filter results",
                                range: range,
                                sortText: "1",
                                command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                            },
                            {
                                label: "leftJoin",
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: "leftJoin($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Left join",
                                range: range,
                                sortText: "2",
                                command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                            },
                            {
                                label: "innerJoin",
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: "innerJoin($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Inner join",
                                range: range,
                                sortText: "3",
                                command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                            },
                            {
                                label: "orderBy",
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: "orderBy($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Order results",
                                range: range,
                                sortText: "4"
                            },
                            {
                                label: "limit",
                                kind: monaco.languages.CompletionItemKind.Method,
                                insertText: "limit($0)",
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                detail: "Limit rows",
                                range: range,
                                sortText: "5"
                            }
                        );
                    }
                    return buildSuggestions(range, suggestions);
                }

                if (chainMode === "insert") {
                    return buildSuggestions(range, [
                        {
                            label: "values",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "values($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Insert values",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "returning",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "returning()",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Return rows",
                            range: range,
                            sortText: "1"
                        }
                    ]);
                }

                if (chainMode === "update") {
                    return buildSuggestions(range, [
                        {
                            label: "set",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "set($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Set values",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        },
                        {
                            label: "where",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "where($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Filter rows",
                            range: range,
                            sortText: "1"
                        }
                    ]);
                }

                if (chainMode === "delete") {
                    return buildSuggestions(range, [
                        {
                            label: "where",
                            kind: monaco.languages.CompletionItemKind.Method,
                            insertText: "where($0)",
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            detail: "Filter rows",
                            range: range,
                            sortText: "0",
                            command: { id: "editor.action.triggerSuggest", title: "Trigger Suggest" }
                        }
                    ]);
                }

                return buildSuggestions(range, []);
            }
        });

        editor.onDidType(function (text) {
            if (shouldSuggest(text)) {
                editor.trigger("drizzle", "editor.action.triggerSuggest", {});
            }
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
            triggerExecution(editor);
        });

        editor.onMouseDown(function (e) {
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

    useEffect(function () {
        if (editorRef.current && monacoRef.current) {
            updateDecorations(editorRef.current, monacoRef.current);
        }
    }, [value]);

    useEffect(function syncTheme() {
        if (monacoRef.current) {
            monacoRef.current.editor.setTheme(editorTheme);
        }
    }, [editorTheme]);

    function updateDecorations(editor: EditorRef, monaco: MonacoApi): void {
        const model = editor.getModel();
        if (!model) return;

        const lineCount = model.getLineCount();
        const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const content = model.getLineContent(i).trim();
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

        decorRef.current = editor.deltaDecorations(decorRef.current, newDecorations);
    }

    function triggerExecution(editor: EditorRef): void {
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
    }

    return (
        <div className="h-full w-full overflow-hidden pt-2 relative group">
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
                height={enableVimMode ? "calc(100% - 24px)" : "100%"}
                defaultLanguage="typescript"
                value={value}
                onChange={function(newValue) { onChange(newValue || ""); }}
                onMount={handleEditorDidMount}
                theme={editorTheme}
                options={{
                    minimap: { enabled: false },
                    fontSize: editorFontSize,
                    lineNumbers: "on",
                    glyphMargin: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordBasedSuggestions: "off",
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: { other: true, comments: false, strings: true },
                    suggest: { showKeywords: false, showSnippets: false, showWords: false },
                    readOnly: isExecuting,
                    padding: { top: 10, bottom: 10 },
                    renderLineHighlight: "all",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}
            />
            {enableVimMode && (
                <div
                    ref={statusBarRef}
                    className="h-6 px-2 flex items-center text-xs font-mono bg-sidebar-accent text-sidebar-foreground border-t border-sidebar-border"
                />
            )}
        </div>
    );
}
