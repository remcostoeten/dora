import type { Token, AstNode } from "../types";
import type { ParseResult, ParserState, ParseError } from "./types";
import { tokenize } from "./lexer";
import {
    createIdentifier,
    createMember,
    createCall,
    createChain,
    createLiteral,
    createIncomplete,
} from "./ast";

function createParserState(tokens: Token[]): ParserState {
    return {
        tokens,
        pos: 0,
        errors: [],
    };
}

function peek(state: ParserState, offset: number = 0): Token {
    const idx = state.pos + offset;
    if (idx >= state.tokens.length) {
        return state.tokens[state.tokens.length - 1];
    }
    return state.tokens[idx];
}

function current(state: ParserState): Token {
    return peek(state, 0);
}

function advance(state: ParserState): Token {
    const token = current(state);
    if (token.kind !== "eof") {
        state.pos++;
    }
    return token;
}

function isEof(state: ParserState): boolean {
    return current(state).kind === "eof";
}

function check(state: ParserState, kind: string): boolean {
    return current(state).kind === kind;
}

function match(state: ParserState, kind: string): boolean {
    if (check(state, kind)) {
        advance(state);
        return true;
    }
    return false;
}

function addError(state: ParserState, message: string, token: Token): void {
    state.errors.push({
        message,
        start: token.start,
        end: token.end,
        line: token.line,
        column: token.column,
    });
}

function parseIdentifier(state: ParserState): AstNode | null {
    if (check(state, "identifier")) {
        const token = advance(state);
        return createIdentifier(token.value, token.start, token.end);
    }
    return null;
}

function parseLiteral(state: ParserState): AstNode | null {
    const token = current(state);

    if (token.kind === "string") {
        advance(state);
        return createLiteral(token.value, token.value, token.start, token.end);
    }

    if (token.kind === "number") {
        advance(state);
        const num = parseFloat(token.value);
        return createLiteral(num, token.value, token.start, token.end);
    }

    if (token.kind === "identifier") {
        if (token.value === "true" || token.value === "false") {
            advance(state);
            return createLiteral(token.value === "true", token.value, token.start, token.end);
        }
    }

    return null;
}

function parseArguments(state: ParserState): AstNode[] {
    const args: AstNode[] = [];

    if (!check(state, "openParen")) {
        return args;
    }

    advance(state);

    while (!isEof(state) && !check(state, "closeParen")) {
        const expr = parseExpression(state);
        if (expr) {
            args.push(expr);
        }

        if (check(state, "comma")) {
            advance(state);
        } else if (!check(state, "closeParen")) {
            break;
        }
    }

    if (check(state, "closeParen")) {
        advance(state);
    }

    return args;
}

function parsePrimary(state: ParserState): AstNode | null {
    const literal = parseLiteral(state);
    if (literal) return literal;

    const ident = parseIdentifier(state);
    if (ident) return ident;

    if (check(state, "openParen")) {
        advance(state);
        const expr = parseExpression(state);
        if (check(state, "closeParen")) {
            advance(state);
        }
        return expr;
    }

    return null;
}

function parseCallOrMember(state: ParserState, left: AstNode): AstNode {
    let result = left;

    while (!isEof(state)) {
        if (check(state, "dot")) {
            advance(state);
            if (check(state, "identifier")) {
                const prop = parseIdentifier(state);
                if (prop) {
                    result = createMember(result, prop);
                }
            } else {
                result = createMember(result, createIncomplete(current(state).start, current(state).start));
            }
        } else if (check(state, "openParen")) {
            const startPos = current(state).start;
            const args = parseArguments(state);
            const endPos = state.tokens[state.pos - 1]?.end || startPos;
            result = createCall(result, args, endPos);
        } else {
            break;
        }
    }

    return result;
}

function parseExpression(state: ParserState): AstNode | null {
    const primary = parsePrimary(state);
    if (!primary) {
        if (check(state, "dot")) {
            return createIncomplete(current(state).start, current(state).end);
        }
        return null;
    }

    return parseCallOrMember(state, primary);
}

function parseChainExpression(state: ParserState): AstNode | null {
    const nodes: AstNode[] = [];

    while (!isEof(state)) {
        const expr = parseExpression(state);
        if (expr) {
            nodes.push(expr);
        }

        if (check(state, "newline") || check(state, "eof")) {
            break;
        }

        if (!check(state, "dot") && !check(state, "openParen")) {
            if (check(state, "identifier") || check(state, "string") || check(state, "number")) {
                continue;
            }
            break;
        }
    }

    if (nodes.length === 0) {
        return null;
    }

    if (nodes.length === 1) {
        return nodes[0];
    }

    return createChain(nodes);
}

export function parse(source: string): ParseResult {
    const tokens = tokenize(source);
    const state = createParserState(tokens);
    const ast = parseChainExpression(state);

    const incomplete = ast ? hasIncomplete(ast) : true;

    return {
        ast,
        tokens,
        errors: state.errors,
        incomplete,
    };
}

function hasIncomplete(node: AstNode): boolean {
    if (node.kind === "incomplete") {
        return true;
    }

    if (node.kind === "call" && node.arguments) {
        for (let i = 0; i < node.arguments.length; i++) {
            if (hasIncomplete(node.arguments[i])) {
                return true;
            }
        }
    }

    if (node.kind === "member") {
        if (node.object && hasIncomplete(node.object)) return true;
        if (node.property && hasIncomplete(node.property)) return true;
    }

    if (node.kind === "chain" && node.nodes) {
        for (let i = 0; i < node.nodes.length; i++) {
            if (hasIncomplete(node.nodes[i])) {
                return true;
            }
        }
    }

    if (node.callee && hasIncomplete(node.callee)) {
        return true;
    }

    return false;
}

export function parseAtPosition(source: string, position: number): ParseResult {
    const beforeCursor = source.substring(0, position);
    return parse(beforeCursor);
}

export function getContextAtPosition(source: string, position: number): {
    result: ParseResult;
    lastToken: Token | null;
    inCall: boolean;
    afterDot: boolean;
} {
    const result = parseAtPosition(source, position);
    const tokens = result.tokens.filter(function (t) {
        return t.kind !== "eof";
    });

    const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const secondLast = tokens.length > 1 ? tokens[tokens.length - 2] : null;

    let inCall = false;
    let afterDot = false;

    if (lastToken) {
        if (lastToken.kind === "openParen") {
            inCall = true;
        }
        if (lastToken.kind === "dot") {
            afterDot = true;
        }
    }

    if (secondLast && secondLast.kind === "openParen" && lastToken && lastToken.kind !== "closeParen") {
        inCall = true;
    }

    return {
        result,
        lastToken,
        inCall,
        afterDot,
    };
}
