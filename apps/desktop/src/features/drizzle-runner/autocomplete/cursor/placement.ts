import type { CursorIntent } from "../types";
import type { InsertResult } from "./types";

export function computeInsertResult(
    text: string,
    intent: CursorIntent
): InsertResult {
    let cursorOffset = text.length;
    let triggerSuggest = false;

    switch (intent) {
        case "stayInside":
            if (text.endsWith("(")) {
                cursorOffset = text.length;
                triggerSuggest = true;
            } else if (text.endsWith(")")) {
                cursorOffset = text.length - 1;
                triggerSuggest = true;
            }
            break;

        case "chainDot":
            if (!text.endsWith(".")) {
                if (text.endsWith(")")) {
                    cursorOffset = text.length;
                }
            }
            triggerSuggest = true;
            break;

        case "complete":
            cursorOffset = text.length;
            triggerSuggest = false;
            break;

        case "openParen":
            cursorOffset = text.length;
            triggerSuggest = true;
            break;

        case "closeParen":
            cursorOffset = text.length;
            triggerSuggest = true;
            break;

        case "none":
        default:
            cursorOffset = text.length;
            break;
    }

    return {
        text,
        cursorOffset,
        triggerSuggest,
    };
}

export function adjustTextForIntent(text: string, intent: CursorIntent): string {
    switch (intent) {
        case "chainDot":
            if (text.endsWith(")") && !text.endsWith(").")) {
                return text + ".";
            }
            break;

        case "stayInside":
            break;

        case "complete":
            break;

        default:
            break;
    }

    return text;
}

export function calculateCursorPosition(
    originalPosition: number,
    insertedText: string,
    cursorOffset: number
): number {
    return originalPosition + cursorOffset;
}

export function shouldAddDotAfter(text: string, intent: CursorIntent): boolean {
    if (intent !== "chainDot") return false;
    if (text.endsWith(".")) return false;
    if (text.endsWith(")")) return true;
    return false;
}

export function getTextWithProperEnding(text: string, intent: CursorIntent): string {
    if (shouldAddDotAfter(text, intent)) {
        return text + ".";
    }
    return text;
}
