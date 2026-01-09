import type { Suggestion, Schema, CompletionContext } from "../types";
import { resolveContext, detectCompletionTrigger } from "../state";
import {
    suggestDbMethods,
    suggestMethods,
    suggestTables,
    suggestColumns,
    suggestAllColumns,
    suggestConditionHelpers,
    suggestSortHelpers,
    deduplicate,
    rankSuggestions,
} from "../suggest";
import { isHelper } from "../suggest";
import { shouldTriggerSuggest } from "../cursor";

export type MonacoPosition = {
    lineNumber: number;
    column: number;
};

export type MonacoRange = {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
};

export type MonacoCompletionItem = {
    label: string;
    kind: number;
    insertText: string;
    insertTextRules?: number;
    detail?: string;
    documentation?: string;
    sortText?: string;
    range?: MonacoRange;
    command?: {
        id: string;
        title: string;
    };
};

export type MonacoCompletionList = {
    suggestions: MonacoCompletionItem[];
    incomplete?: boolean;
};

export function createCompletionProvider(schema: Schema) {
    return {
        triggerCharacters: [".", "(", ","],
        provideCompletionItems: function (model: any, position: MonacoPosition, context: any, token: any): MonacoCompletionList {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });

            const fullText = model.getValue();
            const offset = model.getOffsetAt(position);

            const range: MonacoRange = {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            };

            const ctx = resolveContext(textUntilPosition, textUntilPosition.length, schema);
            const trigger = detectCompletionTrigger(textUntilPosition, textUntilPosition.length);

            let suggestions: Suggestion[] = [];

            if (trigger === "dot") {
                suggestions = getSuggestionsAfterDot(ctx, schema);
            } else if (trigger === "openParen") {
                suggestions = getSuggestionsInsideCall(ctx, schema, textUntilPosition);
            } else if (trigger === "comma") {
                suggestions = getSuggestionsInsideCall(ctx, schema, textUntilPosition);
            } else if (trigger === "identifier") {
                suggestions = getAllSuggestions(ctx, schema);
            } else {
                suggestions = getAllSuggestions(ctx, schema);
            }

            suggestions = deduplicate(suggestions);

            if (ctx.prefix && ctx.prefix.length > 0) {
                suggestions = rankSuggestions(suggestions, ctx.prefix);
            }

            const monacoItems = suggestions.map(function (s) {
                return toMonacoItem(s, range);
            });

            return {
                suggestions: monacoItems,
                incomplete: false,
            };
        },
    };
}

function getSuggestionsAfterDot(ctx: CompletionContext, schema: Schema): Suggestion[] {
    if (ctx.state.kind === "db") {
        return suggestDbMethods();
    }

    return suggestMethods(ctx.state);
}

function getSuggestionsInsideCall(ctx: CompletionContext, schema: Schema, text: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const method = findEnclosingMethod(text);

    if (method === "from" || method === "insert" || method === "update" || method === "delete") {
        return suggestTables(schema, true);
    }

    if (method === "where" || method === "having") {
        const cols = suggestColumns(schema, ctx.state.tables);
        const helpers = suggestConditionHelpers();
        return [...helpers, ...cols];
    }

    if (method === "orderBy") {
        const cols = suggestColumns(schema, ctx.state.tables);
        const helpers = suggestSortHelpers();
        return [...helpers, ...cols];
    }

    if (method === "groupBy") {
        return suggestColumns(schema, ctx.state.tables);
    }

    if (method === "select") {
        if (ctx.state.tables.length > 0) {
            return suggestColumns(schema, ctx.state.tables);
        }
        return suggestAllColumns(schema);
    }

    if (method === "leftJoin" || method === "rightJoin" || method === "innerJoin" || method === "fullJoin") {
        const colIdx = countCommas(text);
        if (colIdx === 0) {
            return suggestTables(schema, false);
        }
        const helpers = suggestConditionHelpers();
        const cols = suggestColumns(schema, ctx.state.tables);
        return [...helpers, ...cols];
    }

    if (isHelper(method || "")) {
        return suggestColumns(schema, ctx.state.tables);
    }

    return suggestions;
}

function getAllSuggestions(ctx: CompletionContext, schema: Schema): Suggestion[] {
    const text = ctx.textBefore;

    if (/db\.$/.test(text)) {
        return suggestDbMethods();
    }

    if (ctx.state.inArg) {
        return getSuggestionsInsideCall(ctx, schema, text);
    }

    if (ctx.state.kind !== "db" && ctx.state.kind !== "terminal") {
        return suggestMethods(ctx.state);
    }

    return [];
}

function findEnclosingMethod(text: string): string | null {
    let depth = 0;
    let methodEnd = -1;

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];

        if (ch === ")") {
            depth++;
        } else if (ch === "(") {
            if (depth === 0) {
                methodEnd = i;
                break;
            }
            depth--;
        }
    }

    if (methodEnd < 0) return null;

    let methodStart = methodEnd;
    for (let i = methodEnd - 1; i >= 0; i--) {
        const ch = text[i];
        if (/[a-zA-Z_$0-9]/.test(ch)) {
            methodStart = i;
        } else {
            break;
        }
    }

    if (methodStart < methodEnd) {
        return text.substring(methodStart, methodEnd);
    }

    return null;
}

function countCommas(text: string): number {
    let count = 0;
    let depth = 0;

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];

        if (ch === ")") {
            depth++;
        } else if (ch === "(") {
            if (depth === 0) break;
            depth--;
        } else if (ch === "," && depth === 0) {
            count++;
        }
    }

    return count;
}

function toMonacoItem(suggestion: Suggestion, range: MonacoRange): MonacoCompletionItem {
    const kindMap: Record<string, number> = {
        method: 0,
        table: 6,
        column: 4,
        helper: 1,
        keyword: 17,
        value: 11,
        snippet: 15,
    };

    const item: MonacoCompletionItem = {
        label: suggestion.label,
        kind: kindMap[suggestion.kind] || 0,
        insertText: suggestion.insert,
        detail: suggestion.detail,
        documentation: suggestion.doc,
        sortText: suggestion.sort,
        range,
    };

    if (suggestion.snippet) {
        item.insertTextRules = 4;
    }

    if (shouldTriggerSuggest(suggestion.cursor) || suggestion.command === "triggerSuggest") {
        item.command = {
            id: "editor.action.triggerSuggest",
            title: "Trigger Suggest",
        };
    }

    return item;
}

export function getCompletionItemKind(monaco: any): Record<string, number> {
    return {
        method: monaco.languages.CompletionItemKind.Method,
        table: monaco.languages.CompletionItemKind.Class,
        column: monaco.languages.CompletionItemKind.Field,
        helper: monaco.languages.CompletionItemKind.Function,
        keyword: monaco.languages.CompletionItemKind.Keyword,
        value: monaco.languages.CompletionItemKind.Value,
        snippet: monaco.languages.CompletionItemKind.Snippet,
    };
}
