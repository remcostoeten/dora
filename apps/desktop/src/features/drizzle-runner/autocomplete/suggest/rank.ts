import type { Suggestion, SuggestionKind } from "../types";
import type { SuggestionFilter, RankingWeights } from "./types";

const DEFAULT_WEIGHTS: RankingWeights = {
    exact: 1000,
    prefix: 100,
    contains: 10,
    kind: {
        method: 50,
        table: 40,
        column: 30,
        helper: 20,
        keyword: 10,
        value: 5,
        snippet: 0,
    },
};

export function deduplicate(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Map<string, Suggestion>();

    for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        const key = s.label + "|" + s.kind;

        if (!seen.has(key)) {
            seen.set(key, s);
        }
    }

    const result: Suggestion[] = [];
    seen.forEach(function (s) {
        result.push(s);
    });

    return result;
}

export function filterSuggestions(suggestions: Suggestion[], filter: SuggestionFilter): Suggestion[] {
    let result = suggestions;

    if (filter.kinds && filter.kinds.length > 0) {
        result = result.filter(function (s) {
            return filter.kinds!.includes(s.kind);
        });
    }

    if (filter.prefix && filter.prefix.length > 0) {
        const prefix = filter.prefix.toLowerCase();
        result = result.filter(function (s) {
            return s.label.toLowerCase().startsWith(prefix) ||
                s.label.toLowerCase().includes(prefix);
        });
    }

    if (filter.limit && filter.limit > 0) {
        result = result.slice(0, filter.limit);
    }

    return result;
}

export function rankSuggestions(
    suggestions: Suggestion[],
    prefix: string,
    weights: RankingWeights = DEFAULT_WEIGHTS
): Suggestion[] {
    if (!prefix || prefix.length === 0) {
        return sortByDefault(suggestions);
    }

    const lowerPrefix = prefix.toLowerCase();
    const scored: Array<{ suggestion: Suggestion; score: number }> = [];

    for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        let score = 0;

        const lowerLabel = s.label.toLowerCase();

        if (lowerLabel === lowerPrefix) {
            score += weights.exact;
        } else if (lowerLabel.startsWith(lowerPrefix)) {
            score += weights.prefix;
        } else if (lowerLabel.includes(lowerPrefix)) {
            score += weights.contains;
        }

        score += weights.kind[s.kind] || 0;

        scored.push({ suggestion: s, score });
    }

    scored.sort(function (a, b) {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.suggestion.label.localeCompare(b.suggestion.label);
    });

    return scored.map(function (item) {
        return item.suggestion;
    });
}

function sortByDefault(suggestions: Suggestion[]): Suggestion[] {
    const copy = suggestions.slice();

    copy.sort(function (a, b) {
        if (a.sort !== b.sort) {
            return a.sort.localeCompare(b.sort);
        }
        return a.label.localeCompare(b.label);
    });

    return copy;
}

export function assignSortKeys(suggestions: Suggestion[]): Suggestion[] {
    return suggestions.map(function (s, i) {
        return {
            ...s,
            sort: String(i).padStart(4, "0"),
        };
    });
}

export function mergeSuggestions(...lists: Suggestion[][]): Suggestion[] {
    const all: Suggestion[] = [];

    for (let i = 0; i < lists.length; i++) {
        for (let j = 0; j < lists[i].length; j++) {
            all.push(lists[i][j]);
        }
    }

    return deduplicate(all);
}

export function prioritize(suggestions: Suggestion[], labels: string[]): Suggestion[] {
    const priority = new Map<string, number>();

    for (let i = 0; i < labels.length; i++) {
        priority.set(labels[i], labels.length - i);
    }

    const copy = suggestions.slice();

    copy.sort(function (a, b) {
        const pa = priority.get(a.label) || 0;
        const pb = priority.get(b.label) || 0;

        if (pb !== pa) {
            return pb - pa;
        }

        return a.sort.localeCompare(b.sort);
    });

    return copy;
}
