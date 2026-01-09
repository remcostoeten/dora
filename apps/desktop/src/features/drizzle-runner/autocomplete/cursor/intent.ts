import type { CursorIntent, ChainState, Suggestion } from "../types";

export function analyzeIntent(state: ChainState, suggestion: Suggestion): CursorIntent {
    if (suggestion.cursor !== "none") {
        return suggestion.cursor;
    }

    if (suggestion.kind === "method") {
        const methodsWithArgs = [
            "select", "from", "insert", "update", "delete",
            "where", "orderBy", "groupBy", "limit", "offset",
            "leftJoin", "rightJoin", "innerJoin", "fullJoin",
            "values", "set", "having"
        ];

        if (methodsWithArgs.includes(suggestion.label)) {
            return "stayInside";
        }

        if (suggestion.label === "execute" || suggestion.label === "returning") {
            return "complete";
        }

        return "chainDot";
    }

    if (suggestion.kind === "table") {
        return "chainDot";
    }

    if (suggestion.kind === "helper") {
        return "stayInside";
    }

    return "none";
}

export function shouldTriggerSuggest(intent: CursorIntent): boolean {
    return intent === "chainDot" || intent === "stayInside";
}

export function getIntentDescription(intent: CursorIntent): string {
    switch (intent) {
        case "openParen":
            return "Open parenthesis and position cursor inside";
        case "closeParen":
            return "Close parenthesis and position cursor after";
        case "chainDot":
            return "Add dot for method chaining";
        case "stayInside":
            return "Keep cursor inside for argument input";
        case "complete":
            return "No further action needed";
        case "none":
            return "No cursor movement";
    }
}

export function determineMethodIntent(methodName: string): CursorIntent {
    const terminalMethods = ["execute", "toSQL"];
    const noArgMethods = ["returning"];

    if (terminalMethods.includes(methodName)) {
        return "complete";
    }

    if (noArgMethods.includes(methodName)) {
        return "chainDot";
    }

    return "stayInside";
}

export function determineTableIntent(closeParenthesis: boolean): CursorIntent {
    return closeParenthesis ? "chainDot" : "none";
}

export function shouldAutoChain(intent: CursorIntent): boolean {
    return intent === "chainDot";
}
