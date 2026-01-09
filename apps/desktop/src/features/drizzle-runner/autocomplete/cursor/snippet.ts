import type { MethodDef, ArgKind } from "../types";

export function generateSnippet(methodDef: MethodDef): string {
    if (methodDef.args.length === 0 || methodDef.args[0] === "none") {
        return methodDef.name + "()";
    }

    const args = methodDef.args.map(function (arg, i) {
        const placeholder = getPlaceholder(arg, i);
        return "${" + (i + 1) + ":" + placeholder + "}";
    });

    return methodDef.name + "(" + args.join(", ") + ")$0";
}

export function generateSimpleSnippet(methodName: string): string {
    return methodName + "($1)$0";
}

export function generateTableSnippet(methodName: string, tableName: string): string {
    return methodName + "(" + tableName + ")$0";
}

function getPlaceholder(argKind: ArgKind, index: number): string {
    switch (argKind) {
        case "table":
            return "table";
        case "column":
            return "column";
        case "columns":
            return "columns";
        case "condition":
            return "condition";
        case "expression":
            return "expr";
        case "value":
            return "value";
        case "values":
            return "values";
        case "number":
            return "n";
        case "sql":
            return "sql";
        case "none":
        default:
            return "arg" + (index + 1);
    }
}

export function wrapInSnippet(text: string, cursorAfter: boolean): string {
    if (cursorAfter) {
        return text + "$0";
    }
    return text;
}

export function insertTabStop(text: string, position: number, tabStopNumber: number): string {
    const before = text.substring(0, position);
    const after = text.substring(position);
    return before + "$" + tabStopNumber + after;
}

export function createMethodCallSnippet(
    methodName: string,
    argPlaceholders: string[]
): string {
    if (argPlaceholders.length === 0) {
        return methodName + "()$0";
    }

    const args = argPlaceholders.map(function (p, i) {
        return "${" + (i + 1) + ":" + p + "}";
    });

    return methodName + "(" + args.join(", ") + ")$0";
}

export function createChainSnippet(methods: Array<{ name: string; args: string[] }>): string {
    let tabStopCounter = 1;
    const parts: string[] = [];

    for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        if (m.args.length === 0) {
            parts.push("." + m.name + "()");
        } else {
            const args = m.args.map(function (a) {
                const result = "${" + tabStopCounter + ":" + a + "}";
                tabStopCounter++;
                return result;
            });
            parts.push("." + m.name + "(" + args.join(", ") + ")");
        }
    }

    return parts.join("") + "$0";
}
