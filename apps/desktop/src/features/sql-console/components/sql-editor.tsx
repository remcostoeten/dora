import { useRef, useEffect, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useSetting } from "@/core/settings";
import { loadTheme, isBuiltinTheme, MonacoTheme } from "@/core/settings/editor-themes";
import { initVimMode } from "monaco-vim";

type Props = {
    value: string;
    onChange: (value: string) => void;
    onExecute: (sql?: string) => void;
    isExecuting: boolean;
};

export function SqlEditor({ value, onChange, onExecute, isExecuting }: Props) {
    const [editorFontSize] = useSetting("editorFontSize");
    const [editorThemeSetting] = useSetting("editorTheme");
    const [enableVimMode] = useSetting("enableVimMode");
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<any>(null);
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement | null>(null);
    const loadedThemesRef = useRef<Set<string>>(new Set());

    function getThemeFromDocument(): MonacoTheme {
        if (typeof document !== "undefined") {
            const classList = document.documentElement.classList;
            
            // Map custom app themes to included Monaco themes
            if (classList.contains("midnight")) return "dracula";
            if (classList.contains("forest")) return "nord";
            if (classList.contains("monokai")) return "monokai";
            if (classList.contains("github-dark")) return "github-dark";
            
            // Handle variants
            if (classList.contains("claude-dark")) return "vs-dark";
            if (classList.contains("claude")) return "vs"; // Light mode
            
            // Fallback to standard light/dark check
            return classList.contains("light") ? "vs" : "vs-dark";
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

        // Register Execute command (Ctrl/Cmd + Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            triggerExecution(editor);
        });

        // Add "Run line" glyph margin listener
        editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber) {
                    const model = editor.getModel();
                    if (model) {
                        const content = model.getLineContent(lineNumber);
                        if (content && content.trim() && !content.trim().startsWith("--")) {
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

    useEffect(function syncTheme() {
        if (monacoRef.current) {
            monacoRef.current.editor.setTheme(editorTheme);
        }
    }, [editorTheme]);

    const updateDecorations = (editor: any, monaco: any) => {
        const model = editor.getModel();
        if (!model) return;

        const lineCount = model.getLineCount();
        const newDecorations: any[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const content = model.getLineContent(i).trim();
            // Show run button for non-empty executable lines
            if (content.length > 0 && !content.startsWith("--")) {
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
            // If no selection, run the whole query or current block (simplified to current line or all for now)
            // Ideally: Run all
            codeToRun = model.getValue();
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
                height={enableVimMode ? "calc(100% - 24px)" : "100%"}
                defaultLanguage="sql"
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
