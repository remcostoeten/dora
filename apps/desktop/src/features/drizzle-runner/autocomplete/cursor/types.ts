import type { CursorIntent } from "../types";

export type CursorPosition = {
    line: number;
    column: number;
    offset: number;
};

export type CursorAction = {
    intent: CursorIntent;
    text: string;
    moveTo: CursorPosition | null;
    triggerSuggest: boolean;
};

export type InsertResult = {
    text: string;
    cursorOffset: number;
    triggerSuggest: boolean;
};
