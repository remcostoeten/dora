import type { Suggestion } from "../types";

type HelperDef = {
    name: string;
    args: string;
    doc: string;
    category: "comparison" | "logical" | "null" | "array" | "sort" | "aggregate" | "sql";
};

const HELPERS: HelperDef[] = [
    { name: "eq", args: "(column, value)", doc: "Equal: column = value", category: "comparison" },
    { name: "ne", args: "(column, value)", doc: "Not equal: column != value", category: "comparison" },
    { name: "gt", args: "(column, value)", doc: "Greater than: column > value", category: "comparison" },
    { name: "gte", args: "(column, value)", doc: "Greater or equal: column >= value", category: "comparison" },
    { name: "lt", args: "(column, value)", doc: "Less than: column < value", category: "comparison" },
    { name: "lte", args: "(column, value)", doc: "Less or equal: column <= value", category: "comparison" },
    { name: "like", args: "(column, pattern)", doc: "LIKE pattern match", category: "comparison" },
    { name: "ilike", args: "(column, pattern)", doc: "Case-insensitive LIKE", category: "comparison" },
    { name: "between", args: "(column, min, max)", doc: "Between two values", category: "comparison" },
    { name: "and", args: "(...conditions)", doc: "Combine conditions with AND", category: "logical" },
    { name: "or", args: "(...conditions)", doc: "Combine conditions with OR", category: "logical" },
    { name: "not", args: "(condition)", doc: "Negate a condition", category: "logical" },
    { name: "isNull", args: "(column)", doc: "Check if NULL", category: "null" },
    { name: "isNotNull", args: "(column)", doc: "Check if NOT NULL", category: "null" },
    { name: "inArray", args: "(column, values)", doc: "Check if in array", category: "array" },
    { name: "notInArray", args: "(column, values)", doc: "Check if not in array", category: "array" },
    { name: "asc", args: "(column)", doc: "Sort ascending", category: "sort" },
    { name: "desc", args: "(column)", doc: "Sort descending", category: "sort" },
    { name: "count", args: "(column?)", doc: "Count rows", category: "aggregate" },
    { name: "sum", args: "(column)", doc: "Sum values", category: "aggregate" },
    { name: "avg", args: "(column)", doc: "Average value", category: "aggregate" },
    { name: "min", args: "(column)", doc: "Minimum value", category: "aggregate" },
    { name: "max", args: "(column)", doc: "Maximum value", category: "aggregate" },
    { name: "sql", args: "`query`", doc: "Raw SQL expression", category: "sql" },
];

export function suggestHelpers(category?: string): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (let i = 0; i < HELPERS.length; i++) {
        const h = HELPERS[i];
        if (category && h.category !== category) continue;

        suggestions.push({
            label: h.name,
            kind: "helper",
            insert: h.name + "(",
            detail: h.args,
            doc: h.doc,
            sort: padSort(i),
            cursor: "stayInside",
            snippet: false,
        });
    }

    return suggestions;
}

export function suggestConditionHelpers(): Suggestion[] {
    const categories = ["comparison", "logical", "null", "array"];
    const suggestions: Suggestion[] = [];

    for (let i = 0; i < HELPERS.length; i++) {
        const h = HELPERS[i];
        if (!categories.includes(h.category)) continue;

        suggestions.push({
            label: h.name,
            kind: "helper",
            insert: h.name + "(",
            detail: h.args,
            doc: h.doc,
            sort: padSort(i),
            cursor: "stayInside",
            snippet: false,
        });
    }

    return suggestions;
}

export function suggestSortHelpers(): Suggestion[] {
    return suggestHelpers("sort");
}

export function suggestAggregateHelpers(): Suggestion[] {
    return suggestHelpers("aggregate");
}

function padSort(index: number): string {
    return String(index).padStart(4, "0");
}

export function getHelperNames(): string[] {
    return HELPERS.map(function (h) {
        return h.name;
    });
}

export function isHelper(name: string): boolean {
    for (let i = 0; i < HELPERS.length; i++) {
        if (HELPERS[i].name === name) return true;
    }
    return false;
}

export function getHelperCategory(name: string): string | null {
    for (let i = 0; i < HELPERS.length; i++) {
        if (HELPERS[i].name === name) return HELPERS[i].category;
    }
    return null;
}
