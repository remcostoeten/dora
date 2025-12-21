"use client"

import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import sql from "react-syntax-highlighter/dist/esm/languages/hljs/sql"
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"

SyntaxHighlighter.registerLanguage("sql", sql)
SyntaxHighlighter.registerLanguage("json", json)

interface SyntaxHighlighterProps {
    children: string
    language?: string
    className?: string
}

const v0Theme = {
    ...atomOneDark,
    'hljs-keyword': { color: '#c792ea' }, // Keyword purple
    'hljs-selector-tag': { color: '#c792ea' },
    'hljs-string': { color: '#c3e88d' }, // String green
    'hljs-comment': { color: '#a1a1aa' }, // Comment zinc-400
    'hljs-attr': { color: '#89ddff' }, // Attribute light blue
    'hljs-function': { color: '#82aaff' }, // Function blue
}

export function CodeHighlighter({ children, language = "sql", className }: SyntaxHighlighterProps) {
    return (
        <SyntaxHighlighter
            language={language}
            style={v0Theme}
            customStyle={{
                margin: 0,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                background: "transparent",
            }}
            codeTagProps={{
                style: {
                    fontFamily: 'Inter, var(--font-mono), monospace'
                }
            }}
            className={className}
        >
            {children}
        </SyntaxHighlighter>
    )
}

// For components that pass code as prop instead of children
export function SqlHighlighter({ code, className }: { code: string; className?: string }) {
    return <CodeHighlighter className={className}>{code}</CodeHighlighter>
}

export { SyntaxHighlighter }
