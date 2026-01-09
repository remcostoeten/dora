import type { Token, TokenKind } from "../types";
import type { LexerState } from "./types";

function createState(source: string): LexerState {
    return {
        source,
        pos: 0,
        line: 1,
        column: 1,
        tokens: [],
    };
}

function peek(state: LexerState, offset: number = 0): string {
    return state.source[state.pos + offset] || "";
}

function advance(state: LexerState): string {
    const ch = state.source[state.pos] || "";
    state.pos++;
    if (ch === "\n") {
        state.line++;
        state.column = 1;
    } else {
        state.column++;
    }
    return ch;
}

function isEof(state: LexerState): boolean {
    return state.pos >= state.source.length;
}

function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
}

function isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch === "$";
}

function isAlphaNum(ch: string): boolean {
    return isAlpha(ch) || isDigit(ch);
}

function isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t" || ch === "\r";
}

function isOperator(ch: string): boolean {
    return "+-*/%=<>!&|^~?:".includes(ch);
}

function makeToken(
    kind: TokenKind,
    value: string,
    start: number,
    end: number,
    line: number,
    column: number
): Token {
    return { kind, value, start, end, line, column };
}

function readString(state: LexerState, quote: string): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    advance(state);
    let value = "";

    while (!isEof(state) && peek(state) !== quote) {
        if (peek(state) === "\\") {
            advance(state);
            if (!isEof(state)) {
                value += advance(state);
            }
        } else {
            value += advance(state);
        }
    }

    if (peek(state) === quote) {
        advance(state);
    }

    return makeToken("string", value, startPos, state.pos, startLine, startCol);
}

function readTemplate(state: LexerState): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    advance(state);
    let value = "";

    while (!isEof(state) && peek(state) !== "`") {
        if (peek(state) === "\\") {
            advance(state);
            if (!isEof(state)) {
                value += advance(state);
            }
        } else if (peek(state) === "$" && peek(state, 1) === "{") {
            break;
        } else {
            value += advance(state);
        }
    }

    if (peek(state) === "`") {
        advance(state);
        return makeToken("templateEnd", value, startPos, state.pos, startLine, startCol);
    }

    return makeToken("templateStart", value, startPos, state.pos, startLine, startCol);
}

function readNumber(state: LexerState): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    let value = "";

    while (!isEof(state) && (isDigit(peek(state)) || peek(state) === ".")) {
        value += advance(state);
    }

    return makeToken("number", value, startPos, state.pos, startLine, startCol);
}

function readIdentifier(state: LexerState): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    let value = "";

    while (!isEof(state) && isAlphaNum(peek(state))) {
        value += advance(state);
    }

    return makeToken("identifier", value, startPos, state.pos, startLine, startCol);
}

function readWhitespace(state: LexerState): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    let value = "";

    while (!isEof(state) && isWhitespace(peek(state))) {
        value += advance(state);
    }

    return makeToken("whitespace", value, startPos, state.pos, startLine, startCol);
}

function readOperator(state: LexerState): Token {
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;
    let value = "";

    while (!isEof(state) && isOperator(peek(state))) {
        value += advance(state);
        if (value.length >= 3) break;
    }

    return makeToken("operator", value, startPos, state.pos, startLine, startCol);
}

function nextToken(state: LexerState): Token {
    if (isEof(state)) {
        return makeToken("eof", "", state.pos, state.pos, state.line, state.column);
    }

    const ch = peek(state);
    const startPos = state.pos;
    const startLine = state.line;
    const startCol = state.column;

    if (ch === "\n") {
        advance(state);
        return makeToken("newline", "\n", startPos, state.pos, startLine, startCol);
    }

    if (isWhitespace(ch)) {
        return readWhitespace(state);
    }

    if (ch === '"' || ch === "'") {
        return readString(state, ch);
    }

    if (ch === "`") {
        return readTemplate(state);
    }

    if (isDigit(ch)) {
        return readNumber(state);
    }

    if (isAlpha(ch)) {
        return readIdentifier(state);
    }

    if (ch === ".") {
        advance(state);
        return makeToken("dot", ".", startPos, state.pos, startLine, startCol);
    }

    if (ch === "(") {
        advance(state);
        return makeToken("openParen", "(", startPos, state.pos, startLine, startCol);
    }

    if (ch === ")") {
        advance(state);
        return makeToken("closeParen", ")", startPos, state.pos, startLine, startCol);
    }

    if (ch === "[") {
        advance(state);
        return makeToken("openBracket", "[", startPos, state.pos, startLine, startCol);
    }

    if (ch === "]") {
        advance(state);
        return makeToken("closeBracket", "]", startPos, state.pos, startLine, startCol);
    }

    if (ch === "{") {
        advance(state);
        return makeToken("openBrace", "{", startPos, state.pos, startLine, startCol);
    }

    if (ch === "}") {
        advance(state);
        return makeToken("closeBrace", "}", startPos, state.pos, startLine, startCol);
    }

    if (ch === ",") {
        advance(state);
        return makeToken("comma", ",", startPos, state.pos, startLine, startCol);
    }

    if (ch === ":") {
        advance(state);
        return makeToken("colon", ":", startPos, state.pos, startLine, startCol);
    }

    if (isOperator(ch)) {
        return readOperator(state);
    }

    advance(state);
    return makeToken("unknown", ch, startPos, state.pos, startLine, startCol);
}

export function tokenize(source: string): Token[] {
    const state = createState(source);
    const tokens: Token[] = [];

    while (!isEof(state)) {
        const token = nextToken(state);
        if (token.kind !== "whitespace" && token.kind !== "newline") {
            tokens.push(token);
        }
        if (token.kind === "eof") break;
    }

    if (tokens.length === 0 || tokens[tokens.length - 1].kind !== "eof") {
        tokens.push(makeToken("eof", "", state.pos, state.pos, state.line, state.column));
    }

    return tokens;
}

export function tokenizeWithWhitespace(source: string): Token[] {
    const state = createState(source);
    const tokens: Token[] = [];

    while (!isEof(state)) {
        const token = nextToken(state);
        tokens.push(token);
        if (token.kind === "eof") break;
    }

    return tokens;
}

export function findTokenAtPosition(tokens: Token[], position: number): Token | null {
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (position >= token.start && position <= token.end) {
            return token;
        }
    }
    return null;
}

export function findTokenBeforePosition(tokens: Token[], position: number): Token | null {
    let result: Token | null = null;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.end <= position) {
            result = token;
        } else {
            break;
        }
    }
    return result;
}
