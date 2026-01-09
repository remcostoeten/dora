import type { Schema } from "../types";
import { DRIZZLE_METHODS, findMethod } from "../state";
import { isHelper, getHelperCategory } from "../suggest";

export type HoverContent = {
    contents: Array<{ value: string }>;
};

export function createHoverProvider(schema: Schema) {
    return {
        provideHover: function (model: any, position: any) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const wordText = word.word;
            const hover = getHoverContent(wordText, schema);

            if (!hover) return null;

            return {
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: word.endColumn,
                },
                contents: hover.contents,
            };
        },
    };
}

function getHoverContent(word: string, schema: Schema): HoverContent | null {
    if (word === "db") {
        return {
            contents: [
                { value: "**db** - Drizzle database instance" },
                { value: "Use `db.select()`, `db.insert()`, `db.update()`, `db.delete()`" },
            ],
        };
    }

    const table = schema.tables.find(function (t) {
        return t.name === word;
    });

    if (table) {
        const cols = table.columns.map(function (c) {
            return "- " + c.name + ": " + c.type + (c.nullable ? " (nullable)" : "");
        });

        return {
            contents: [
                { value: "**Table: " + table.name + "**" },
                { value: cols.join("\n") },
            ],
        };
    }

    for (let i = 0; i < schema.tables.length; i++) {
        const t = schema.tables[i];
        for (let j = 0; j < t.columns.length; j++) {
            const c = t.columns[j];
            if (c.name === word) {
                return {
                    contents: [
                        { value: "**Column: " + t.name + "." + c.name + "**" },
                        { value: "Type: " + c.type + (c.nullable ? " (nullable)" : "") },
                    ],
                };
            }
        }
    }

    const methodInfo = getMethodHoverInfo(word);
    if (methodInfo) {
        return {
            contents: [
                { value: "**" + methodInfo.name + "**" + methodInfo.signature },
                { value: methodInfo.doc },
            ],
        };
    }

    if (isHelper(word)) {
        const category = getHelperCategory(word);
        const helperInfo = getHelperHoverInfo(word);
        if (helperInfo) {
            return {
                contents: [
                    { value: "**" + word + "** (" + category + " helper)" },
                    { value: helperInfo },
                ],
            };
        }
    }

    return null;
}

type MethodHoverInfo = {
    name: string;
    signature: string;
    doc: string;
};

function getMethodHoverInfo(name: string): MethodHoverInfo | null {
    const methods: Record<string, MethodHoverInfo> = {
        select: { name: "select", signature: "(fields?)", doc: "Start a SELECT query builder" },
        from: { name: "from", signature: "(table)", doc: "Specify the table to select from" },
        where: { name: "where", signature: "(condition)", doc: "Filter results with a condition" },
        insert: { name: "insert", signature: "(table)", doc: "Start an INSERT query" },
        update: { name: "update", signature: "(table)", doc: "Start an UPDATE query" },
        delete: { name: "delete", signature: "(table)", doc: "Start a DELETE query" },
        values: { name: "values", signature: "(data)", doc: "Provide values to insert" },
        set: { name: "set", signature: "(data)", doc: "Set values to update" },
        orderBy: { name: "orderBy", signature: "(...columns)", doc: "Order results by columns" },
        groupBy: { name: "groupBy", signature: "(...columns)", doc: "Group results by columns" },
        having: { name: "having", signature: "(condition)", doc: "Filter groups with a condition" },
        limit: { name: "limit", signature: "(n)", doc: "Limit the number of results" },
        offset: { name: "offset", signature: "(n)", doc: "Offset the results" },
        leftJoin: { name: "leftJoin", signature: "(table, condition)", doc: "Left join another table" },
        rightJoin: { name: "rightJoin", signature: "(table, condition)", doc: "Right join another table" },
        innerJoin: { name: "innerJoin", signature: "(table, condition)", doc: "Inner join another table" },
        fullJoin: { name: "fullJoin", signature: "(table, condition)", doc: "Full outer join another table" },
        returning: { name: "returning", signature: "()", doc: "Return affected rows" },
        execute: { name: "execute", signature: "()", doc: "Execute the query" },
    };

    return methods[name] || null;
}

function getHelperHoverInfo(name: string): string | null {
    const helpers: Record<string, string> = {
        eq: "Equal: column = value",
        ne: "Not equal: column != value",
        gt: "Greater than: column > value",
        lt: "Less than: column < value",
        gte: "Greater or equal: column >= value",
        lte: "Less or equal: column <= value",
        like: "LIKE pattern match",
        ilike: "Case-insensitive LIKE",
        and: "Combine conditions with AND",
        or: "Combine conditions with OR",
        not: "Negate a condition",
        isNull: "Check if NULL",
        isNotNull: "Check if NOT NULL",
        inArray: "Check if in array of values",
        notInArray: "Check if not in array",
        asc: "Sort ascending",
        desc: "Sort descending",
        count: "Count rows or non-null values",
        sum: "Sum numeric values",
        avg: "Average of numeric values",
        min: "Minimum value",
        max: "Maximum value",
        sql: "Raw SQL expression",
    };

    return helpers[name] || null;
}
