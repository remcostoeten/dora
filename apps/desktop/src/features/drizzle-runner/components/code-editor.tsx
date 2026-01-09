import { useRef, useEffect, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { generateDrizzleTypes } from "../utils/lsp-utils";
import { SchemaTable } from "../types";
import {
    createCompletionProvider,
    createSignatureHelpProvider,
    createHoverProvider,
} from "../autocomplete/monaco";
import type { Schema } from "../autocomplete/types";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: (code?: string) => void;
    isExecuting: boolean;
    tables: SchemaTable[];
};

function convertToSchema(tables: SchemaTable[]): Schema {
    return {
        tables: tables.map(function (t) {
            return {
                name: t.name,
                columns: t.columns.map(function (c) {
                    return {
                        name: c.name,
                        type: c.type,
                        nullable: c.nullable,
                        primaryKey: c.primaryKey,
                        defaultValue: c.defaultValue,
                    };
                }),
            };
        }),
    };
}

export function CodeEditor({ value, onChange, onExecute, isExecuting, tables }: Props) {
    const { theme } = useTheme();
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<any>(null);
    const disposablesRef = useRef<any[]>([]);

    const handleEditorDidMount: OnMount = useCallback(function (editor, monaco) {
        editorRef.current = editor;
        monacoRef.current = monaco;

        monaco.editor.setTheme("vs-dark");

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            strict: true,
            noImplicitAny: true,
            typeRoots: ["node_modules/@types"],
        });

        const drizzleTypes = generateDrizzleTypes(tables);
        const libUri = "file:///drizzle.d.ts";
        monaco.languages.typescript.typescriptDefaults.addExtraLib(drizzleTypes, libUri);

        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, "typescript");
        }

        const schema = convertToSchema(tables);

        disposablesRef.current.forEach(function (d) {
            if (d && d.dispose) d.dispose();
        });
        disposablesRef.current = [];

        const completionProvider = monaco.languages.registerCompletionItemProvider(
            "typescript",
            createCompletionProvider(schema)
        );
        disposablesRef.current.push(completionProvider);

        const signatureProvider = monaco.languages.registerSignatureHelpProvider(
            "typescript",
            createSignatureHelpProvider(schema)
        );
        disposablesRef.current.push(signatureProvider);

        const hoverProvider = monaco.languages.registerHoverProvider(
            "typescript",
            createHoverProvider(schema)
        );
        disposablesRef.current.push(hoverProvider);

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
            triggerExecution(editor);
        });

        editor.onMouseDown(function (e: any) {
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
    }, [tables, onExecute]);

    function triggerExecution(editor: any) {
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

    function updateDecorations(editor: any, monaco: any) {
        const model = editor.getModel();
        if (!model) return;

        const lineCount = model.getLineCount();
        const newDecorations: any[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const content = model.getLineContent(i).trim();
            if (content.length > 0 && !content.startsWith("//") && !content.startsWith("/*")) {
                newDecorations.push({
                    range: new monaco.Range(i, 1, i, 1),
                    options: {
                        isWholeLine: false,
                        glyphMarginClassName: "run-glyph-margin",
                        glyphMarginHoverMessage: { value: "Run Line" },
                    },
                });
            }
        }

        const previousDecorations = (editor as any)._previousDecorations || [];
        (editor as any)._previousDecorations = editor.deltaDecorations(previousDecorations, newDecorations);
    }

    useEffect(function () {
        if (editorRef.current && monacoRef.current) {
            updateDecorations(editorRef.current, monacoRef.current);
        }
    }, [value]);

    useEffect(function () {
        return function () {
            disposablesRef.current.forEach(function (d) {
                if (d && d.dispose) d.dispose();
            });
        };
    }, []);

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
                height="100%"
                defaultLanguage="typescript"
                value={value}
                onChange={function (newValue) { onChange(newValue || ""); }}
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
                    quickSuggestions: {
                        other: true,
                        comments: false,
                        strings: false,
                    },
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnCommitCharacter: true,
                    snippetSuggestions: "top",
                }}
            />
        </div>
    );
}
