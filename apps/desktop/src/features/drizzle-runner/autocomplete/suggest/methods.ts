import type { Suggestion, ChainState, CursorIntent } from "../types";
import { DRIZZLE_METHODS, getUniqueMethodsForState } from "../state";

export function suggestMethods(state: ChainState): Suggestion[] {
    const methods = getUniqueMethodsForState(DRIZZLE_METHODS, state.kind);
    const suggestions: Suggestion[] = [];

    for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        const hasArgs = m.args.length > 0 && m.args[0] !== "none";

        let insert: string;
        let cursor: CursorIntent;
        let snippet = false;

        if (m.terminal) {
            insert = m.name + "()";
            cursor = "complete";
        } else if (hasArgs) {
            insert = m.name + "(";
            cursor = "stayInside";
        } else {
            insert = m.name + "()";
            cursor = "chainDot";
        }

        suggestions.push({
            label: m.name,
            kind: "method",
            insert,
            detail: buildDetail(m.args),
            doc: m.doc,
            sort: padSort(i),
            cursor,
            snippet,
            command: hasArgs ? undefined : "triggerSuggest",
        });
    }

    return suggestions;
}

function buildDetail(args: string[]): string {
    if (args.length === 0 || (args.length === 1 && args[0] === "none")) {
        return "()";
    }
    return "(" + args.join(", ") + ")";
}

function padSort(index: number): string {
    return String(index).padStart(4, "0");
}

export function suggestDbMethods(): Suggestion[] {
    return [
        {
            label: "select",
            kind: "method",
            insert: "select(",
            detail: "(columns?)",
            doc: "Start a SELECT query",
            sort: "0000",
            cursor: "stayInside",
            snippet: false,
        },
        {
            label: "insert",
            kind: "method",
            insert: "insert(",
            detail: "(table)",
            doc: "Start an INSERT query",
            sort: "0001",
            cursor: "stayInside",
            snippet: false,
        },
        {
            label: "update",
            kind: "method",
            insert: "update(",
            detail: "(table)",
            doc: "Start an UPDATE query",
            sort: "0002",
            cursor: "stayInside",
            snippet: false,
        },
        {
            label: "delete",
            kind: "method",
            insert: "delete(",
            detail: "(table)",
            doc: "Start a DELETE query",
            sort: "0003",
            cursor: "stayInside",
            snippet: false,
        },
        {
            label: "execute",
            kind: "method",
            insert: "execute(sql`",
            detail: "(sql)",
            doc: "Execute raw SQL",
            sort: "0004",
            cursor: "stayInside",
            snippet: true,
        },
    ];
}

export function suggestSelectChainMethods(hasFrom: boolean, hasWhere: boolean): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (!hasFrom) {
        suggestions.push({
            label: "from",
            kind: "method",
            insert: "from(",
            detail: "(table)",
            doc: "Specify the table to select from",
            sort: "0000",
            cursor: "stayInside",
            snippet: false,
        });
    }

    if (hasFrom) {
        if (!hasWhere) {
            suggestions.push({
                label: "where",
                kind: "method",
                insert: "where(",
                detail: "(condition)",
                doc: "Filter results with a condition",
                sort: "0000",
                cursor: "stayInside",
                snippet: false,
            });
        }

        suggestions.push(
            {
                label: "orderBy",
                kind: "method",
                insert: "orderBy(",
                detail: "(columns)",
                doc: "Order results by columns",
                sort: "0001",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "groupBy",
                kind: "method",
                insert: "groupBy(",
                detail: "(columns)",
                doc: "Group results by columns",
                sort: "0002",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "limit",
                kind: "method",
                insert: "limit(",
                detail: "(number)",
                doc: "Limit the number of results",
                sort: "0003",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "offset",
                kind: "method",
                insert: "offset(",
                detail: "(number)",
                doc: "Offset the results",
                sort: "0004",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "leftJoin",
                kind: "method",
                insert: "leftJoin(",
                detail: "(table, condition)",
                doc: "Left join another table",
                sort: "0005",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "innerJoin",
                kind: "method",
                insert: "innerJoin(",
                detail: "(table, condition)",
                doc: "Inner join another table",
                sort: "0006",
                cursor: "stayInside",
                snippet: false,
            },
            {
                label: "execute",
                kind: "method",
                insert: "execute()",
                detail: "()",
                doc: "Execute the query",
                sort: "0099",
                cursor: "complete",
                snippet: false,
            }
        );
    }

    return suggestions;
}
