import type { Schema, SchemaTable } from "../types";
import { DRIZZLE_METHODS, getMethodsForState } from "../state";

export type SignatureInfo = {
    label: string;
    documentation: string;
    parameters: ParameterInfo[];
    activeParameter: number;
};

export type ParameterInfo = {
    label: string;
    documentation: string;
};

export function createSignatureHelpProvider(schema: Schema) {
    return {
        signatureHelpTriggerCharacters: ["(", ","],
        signatureHelpRetriggerCharacters: [","],
        provideSignatureHelp: function (model: any, position: any, token: any, context: any) {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });

            const methodName = findCurrentMethod(textUntilPosition);
            if (!methodName) {
                return null;
            }

            const signature = getMethodSignature(methodName, schema);
            if (!signature) {
                return null;
            }

            const activeParam = countActiveParameter(textUntilPosition);

            return {
                value: {
                    signatures: [{
                        label: signature.label,
                        documentation: signature.documentation,
                        parameters: signature.parameters.map(function (p) {
                            return {
                                label: p.label,
                                documentation: p.documentation,
                            };
                        }),
                    }],
                    activeSignature: 0,
                    activeParameter: Math.min(activeParam, signature.parameters.length - 1),
                },
                dispose: function () { },
            };
        },
    };
}

function findCurrentMethod(text: string): string | null {
    let depth = 0;
    let methodEnd = -1;

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ")") depth++;
        else if (ch === "(") {
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
        if (/[a-zA-Z_$0-9]/.test(text[i])) {
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

function countActiveParameter(text: string): number {
    let depth = 0;
    let count = 0;

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ")") depth++;
        else if (ch === "(") {
            if (depth === 0) break;
            depth--;
        } else if (ch === "," && depth === 0) {
            count++;
        }
    }

    return count;
}

function getMethodSignature(name: string, schema: Schema): SignatureInfo | null {
    const signatures: Record<string, SignatureInfo> = {
        select: {
            label: "select(fields?)",
            documentation: "Start a SELECT query. Optionally specify fields to select.",
            parameters: [{ label: "fields", documentation: "Object with field selections" }],
            activeParameter: 0,
        },
        from: {
            label: "from(table)",
            documentation: "Specify the table to select from.",
            parameters: [{ label: "table", documentation: getTableDoc(schema) }],
            activeParameter: 0,
        },
        where: {
            label: "where(condition)",
            documentation: "Filter results with a condition.",
            parameters: [{ label: "condition", documentation: "Use eq(), gt(), and(), or(), etc." }],
            activeParameter: 0,
        },
        insert: {
            label: "insert(table)",
            documentation: "Start an INSERT query.",
            parameters: [{ label: "table", documentation: getTableDoc(schema) }],
            activeParameter: 0,
        },
        update: {
            label: "update(table)",
            documentation: "Start an UPDATE query.",
            parameters: [{ label: "table", documentation: getTableDoc(schema) }],
            activeParameter: 0,
        },
        delete: {
            label: "delete(table)",
            documentation: "Start a DELETE query.",
            parameters: [{ label: "table", documentation: getTableDoc(schema) }],
            activeParameter: 0,
        },
        values: {
            label: "values(data)",
            documentation: "Provide values to insert.",
            parameters: [{ label: "data", documentation: "Object or array of objects" }],
            activeParameter: 0,
        },
        set: {
            label: "set(data)",
            documentation: "Set values to update.",
            parameters: [{ label: "data", documentation: "Object with column: value pairs" }],
            activeParameter: 0,
        },
        orderBy: {
            label: "orderBy(...columns)",
            documentation: "Order results by columns.",
            parameters: [{ label: "columns", documentation: "Use asc() or desc() wrappers" }],
            activeParameter: 0,
        },
        groupBy: {
            label: "groupBy(...columns)",
            documentation: "Group results by columns.",
            parameters: [{ label: "columns", documentation: "Column references" }],
            activeParameter: 0,
        },
        limit: {
            label: "limit(n)",
            documentation: "Limit the number of results.",
            parameters: [{ label: "n", documentation: "Number of rows to return" }],
            activeParameter: 0,
        },
        offset: {
            label: "offset(n)",
            documentation: "Offset the results.",
            parameters: [{ label: "n", documentation: "Number of rows to skip" }],
            activeParameter: 0,
        },
        leftJoin: {
            label: "leftJoin(table, condition)",
            documentation: "Left join another table.",
            parameters: [
                { label: "table", documentation: getTableDoc(schema) },
                { label: "condition", documentation: "Join condition using eq()" },
            ],
            activeParameter: 0,
        },
        innerJoin: {
            label: "innerJoin(table, condition)",
            documentation: "Inner join another table.",
            parameters: [
                { label: "table", documentation: getTableDoc(schema) },
                { label: "condition", documentation: "Join condition using eq()" },
            ],
            activeParameter: 0,
        },
        eq: {
            label: "eq(column, value)",
            documentation: "Check equality: column = value",
            parameters: [
                { label: "column", documentation: "Column reference" },
                { label: "value", documentation: "Value to compare" },
            ],
            activeParameter: 0,
        },
        ne: {
            label: "ne(column, value)",
            documentation: "Check inequality: column != value",
            parameters: [
                { label: "column", documentation: "Column reference" },
                { label: "value", documentation: "Value to compare" },
            ],
            activeParameter: 0,
        },
        gt: {
            label: "gt(column, value)",
            documentation: "Greater than: column > value",
            parameters: [
                { label: "column", documentation: "Column reference" },
                { label: "value", documentation: "Value to compare" },
            ],
            activeParameter: 0,
        },
        lt: {
            label: "lt(column, value)",
            documentation: "Less than: column < value",
            parameters: [
                { label: "column", documentation: "Column reference" },
                { label: "value", documentation: "Value to compare" },
            ],
            activeParameter: 0,
        },
    };

    return signatures[name] || null;
}

function getTableDoc(schema: Schema): string {
    const names = schema.tables.map(function (t) {
        return t.name;
    });
    return "Tables: " + names.join(", ");
}
