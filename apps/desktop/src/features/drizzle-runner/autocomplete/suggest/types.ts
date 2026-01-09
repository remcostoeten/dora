import type { Suggestion, SuggestionKind, CursorIntent } from "../types";

export type SuggestionFilter = {
    kinds?: SuggestionKind[];
    prefix?: string;
    limit?: number;
};

export type RankingWeights = {
    exact: number;
    prefix: number;
    contains: number;
    kind: Record<SuggestionKind, number>;
};
