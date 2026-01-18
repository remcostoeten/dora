import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type CellPosition = {
    row: number;
    col: number;
};

type ContextMenuState = {
    cell: CellPosition;
    x: number;
    y: number;
} | null;

type UrlTableState = {
    focusedCell: CellPosition | null;
    selectedRow: number | null;
    selectedCells: Set<string>;
    contextMenu: ContextMenuState;
    addRecordMode: boolean;
    addRecordIndex: number | null;
};

function parseCellPosition(value: string): CellPosition | null {
    const parts = value.split(":");
    if (parts.length !== 2) return null;
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    if (isNaN(row) || isNaN(col)) return null;
    return { row, col };
}

function parseSelectedCells(value: string): Set<string> {
    const cells = new Set<string>();
    if (!value) return cells;

    const pairs = value.split(",");
    for (const pair of pairs) {
        const pos = parseCellPosition(pair);
        if (pos) {
            cells.add(`${pos.row}:${pos.col}`);
        }
    }
    return cells;
}

function parseContextMenu(value: string): ContextMenuState {
    const parts = value.split(":");
    if (parts.length !== 4) return null;

    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const x = parseInt(parts[2], 10);
    const y = parseInt(parts[3], 10);

    if (isNaN(row) || isNaN(col) || isNaN(x) || isNaN(y)) return null;
    return { cell: { row, col }, x, y };
}

function parseAddRecord(value: string | null): { enabled: boolean; index: number | null } {
    if (!value) return { enabled: false, index: null };
    if (value === "true") return { enabled: true, index: null };
    const index = parseInt(value, 10);
    if (isNaN(index)) return { enabled: true, index: null };
    return { enabled: true, index };
}

export function parseUrlState(searchParams: URLSearchParams): UrlTableState {
    const cellParam = searchParams.get("cell");
    const rowParam = searchParams.get("row");
    const cellsParam = searchParams.get("cells");
    const ctxParam = searchParams.get("ctx");
    const addRecordParam = searchParams.get("addRecord");

    const focusedCell = cellParam ? parseCellPosition(cellParam) : null;
    const selectedRow = rowParam ? parseInt(rowParam, 10) : null;
    const selectedCells = cellsParam ? parseSelectedCells(cellsParam) : new Set<string>();
    const contextMenu = ctxParam ? parseContextMenu(ctxParam) : null;
    const addRecord = parseAddRecord(addRecordParam);

    return {
        focusedCell,
        selectedRow: isNaN(selectedRow as number) ? null : selectedRow,
        selectedCells,
        contextMenu,
        addRecordMode: addRecord.enabled,
        addRecordIndex: addRecord.index,
    };
}

export function serializeUrlState(
    state: Partial<UrlTableState>,
    currentParams: URLSearchParams
): URLSearchParams {
    const params = new URLSearchParams(currentParams);

    if (state.focusedCell !== undefined) {
        if (state.focusedCell) {
            params.set("cell", `${state.focusedCell.row}:${state.focusedCell.col}`);
        } else {
            params.delete("cell");
        }
    }

    if (state.selectedRow !== undefined) {
        if (state.selectedRow !== null) {
            params.set("row", String(state.selectedRow));
        } else {
            params.delete("row");
        }
    }

    if (state.selectedCells !== undefined) {
        if (state.selectedCells.size > 0) {
            params.set("cells", Array.from(state.selectedCells).join(","));
        } else {
            params.delete("cells");
        }
    }

    if (state.contextMenu !== undefined) {
        if (state.contextMenu) {
            const { cell, x, y } = state.contextMenu;
            params.set("ctx", `${cell.row}:${cell.col}:${x}:${y}`);
        } else {
            params.delete("ctx");
        }
    }

    if (state.addRecordMode !== undefined) {
        if (state.addRecordMode) {
            if (state.addRecordIndex !== null && state.addRecordIndex !== undefined) {
                params.set("addRecord", String(state.addRecordIndex));
            } else {
                params.set("addRecord", "true");
            }
        } else {
            params.delete("addRecord");
        }
    }

    return params;
}

type UseUrlStateOptions = {
    debounceMs?: number;
};

type UseUrlStateReturn = {
    urlState: UrlTableState;
    setFocusedCell: (cell: CellPosition | null) => void;
    setSelectedRow: (row: number | null) => void;
    setSelectedCells: (cells: Set<string>) => void;
    setContextMenu: (ctx: ContextMenuState) => void;
    setAddRecordMode: (enabled: boolean, index?: number | null) => void;
    clearUrlState: () => void;
};

export function useUrlState(options: UseUrlStateOptions = {}): UseUrlStateReturn {
    const { debounceMs = 100 } = options;
    const [searchParams, setSearchParams] = useSearchParams();

    const urlState = useMemo(function () {
        return parseUrlState(searchParams);
    }, [searchParams]);

    const updateParams = useCallback(function (updater: (params: URLSearchParams) => URLSearchParams) {
        setSearchParams(function (current) {
            return updater(current);
        }, { replace: true });
    }, [setSearchParams]);

    const setFocusedCell = useCallback(function (cell: CellPosition | null) {
        updateParams(function (params) {
            return serializeUrlState({ focusedCell: cell }, params);
        });
    }, [updateParams]);

    const setSelectedRow = useCallback(function (row: number | null) {
        updateParams(function (params) {
            return serializeUrlState({ selectedRow: row }, params);
        });
    }, [updateParams]);

    const setSelectedCells = useCallback(function (cells: Set<string>) {
        updateParams(function (params) {
            return serializeUrlState({ selectedCells: cells }, params);
        });
    }, [updateParams]);

    const setContextMenu = useCallback(function (ctx: ContextMenuState) {
        updateParams(function (params) {
            return serializeUrlState({ contextMenu: ctx }, params);
        });
    }, [updateParams]);

    const setAddRecordMode = useCallback(function (enabled: boolean, index?: number | null) {
        updateParams(function (params) {
            return serializeUrlState({
                addRecordMode: enabled,
                addRecordIndex: index ?? null
            }, params);
        });
    }, [updateParams]);

    const clearUrlState = useCallback(function () {
        updateParams(function (params) {
            params.delete("cell");
            params.delete("row");
            params.delete("cells");
            params.delete("ctx");
            params.delete("addRecord");
            return params;
        });
    }, [updateParams]);

    return {
        urlState,
        setFocusedCell,
        setSelectedRow,
        setSelectedCells,
        setContextMenu,
        setAddRecordMode,
        clearUrlState,
    };
}
