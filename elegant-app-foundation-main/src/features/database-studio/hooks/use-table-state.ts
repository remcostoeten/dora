import { useState, useCallback, useMemo, useRef } from "react";
import type { TableInfo, FilterCondition, SortConfig, CellDraft, TableRow } from "../types";
import { MOCK_TABLES, getColumnsForTable, getDataForTable } from "../data/mock-data";

export function useTableState() {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(MOCK_TABLES[9]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTables, setShowTables] = useState(true);
  const [showViews, setShowViews] = useState(true);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Map<string, CellDraft>>(new Map());
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set());
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [newRows, setNewRows] = useState<TableRow[]>([]);
  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(new Map());
  const lastClickedRowRef = useRef<number | null>(null);
  const lastClickedCellRef = useRef<string | null>(null);

  const tables = useMemo(() => {
    return MOCK_TABLES.filter((table) => {
      const matchesSearch = table.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = (showTables && table.type === "table") || (showViews && table.type === "view");
      return matchesSearch && matchesType;
    });
  }, [searchQuery, showTables, showViews]);

  const columns = useMemo(() => {
    if (!selectedTable) return [];
    return getColumnsForTable(selectedTable.name);
  }, [selectedTable]);

  const baseRows = useMemo(() => {
    if (!selectedTable) return [];
    return getDataForTable(selectedTable.name);
  }, [selectedTable]);

  const rows = useMemo(() => {
    return [...newRows, ...baseRows];
  }, [newRows, baseRows]);

  const handleSelectTable = useCallback((table: TableInfo) => {
    setSelectedTable(table);
    setVisibleColumns([]);
    setFilters([]);
    setSortConfig(null);
    setSelectedRows(new Set());
    setDrafts(new Map());
    setEditingCells(new Set());
    setSelectedCells(new Set());
    setNewRows([]);
    setColumnWidths(new Map());
    lastClickedRowRef.current = null;
    lastClickedCellRef.current = null;
  }, []);

  const handleToggleColumn = useCallback((columnName: string) => {
    setVisibleColumns((prev) => {
      if (prev.length === 0) {
        const allCols = columns.map((c) => c.name);
        return allCols.filter((c) => c !== columnName);
      }
      if (prev.includes(columnName)) {
        return prev.filter((c) => c !== columnName);
      }
      return [...prev, columnName];
    });
  }, [columns]);

  const handleToggleAllColumns = useCallback((checked: boolean) => {
    if (checked) {
      setVisibleColumns([]);
    } else {
      setVisibleColumns([]);
    }
  }, []);

  const displayColumns = useMemo(() => {
    if (visibleColumns.length === 0) return columns;
    return columns.filter((c) => visibleColumns.includes(c.name));
  }, [columns, visibleColumns]);

  const handleAddFilter = useCallback(() => {
    if (columns.length === 0) return;
    const newFilter: FilterCondition = {
      id: crypto.randomUUID(),
      column: columns[0].name,
      operator: "equals",
      value: "",
    };
    setFilters((prev) => [...prev, newFilter]);
  }, [columns]);

  const handleRemoveFilter = useCallback((id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleUpdateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleSort = useCallback((column: string) => {
    setSortConfig((prev) => {
      if (prev?.column === column) {
        return prev.direction === "asc" ? { column, direction: "desc" } : null;
      }
      return { column, direction: "asc" };
    });
  }, []);

  const handleRowClick = useCallback((rowIndex: number, rowId: string, event: React.MouseEvent) => {
    const rowIds = rows.map((r, i) => String(r.id ?? `new-${i}`));
    
    if (event.shiftKey && lastClickedRowRef.current !== null) {
      const start = Math.min(lastClickedRowRef.current, rowIndex);
      const end = Math.max(lastClickedRowRef.current, rowIndex);
      const rangeIds = rowIds.slice(start, end + 1);
      setSelectedRows((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
      lastClickedRowRef.current = rowIndex;
    } else {
      setSelectedRows(new Set([rowId]));
      lastClickedRowRef.current = rowIndex;
    }
  }, [rows]);

  const handleToggleRow = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleSelectAllRows = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(rows.map((r, i) => String(r.id ?? `new-${i}`))));
    } else {
      setSelectedRows(new Set());
    }
  }, [rows]);

  const handleCellClick = useCallback((rowId: string, column: string, event: React.MouseEvent) => {
    const key = `${rowId}:${column}`;

    if (event.ctrlKey || event.metaKey) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      lastClickedCellRef.current = key;
    } else if (event.shiftKey && lastClickedCellRef.current) {
      const [lastRowId, lastColumn] = lastClickedCellRef.current.split(":");
      const currentRowIndex = rows.findIndex((r) => String(r.id ?? `new-${rows.indexOf(r)}`) === rowId);
      const lastRowIndex = rows.findIndex((r) => String(r.id ?? `new-${rows.indexOf(r)}`) === lastRowId);

      const columnNames = displayColumns.map((c) => c.name);
      const currentColIndex = columnNames.indexOf(column);
      const lastColIndex = columnNames.indexOf(lastColumn);

      const startRow = Math.min(currentRowIndex, lastRowIndex);
      const endRow = Math.max(currentRowIndex, lastRowIndex);
      const startCol = Math.min(currentColIndex, lastColIndex);
      const endCol = Math.max(currentColIndex, lastColIndex);

      setSelectedCells((prev) => {
        const next = new Set(prev);
        for (let r = startRow; r <= endRow; r++) {
          const rId = String(rows[r].id ?? `new-${r}`);
          for (let c = startCol; c <= endCol; c++) {
            const cName = columnNames[c];
            next.add(`${rId}:${cName}`);
          }
        }
        return next;
      });
    } else {
      setSelectedCells(new Set([key]));
      lastClickedCellRef.current = key;
    }
  }, [rows, displayColumns]);

  const handleCellDoubleClick = useCallback((rowId: string, column: string) => {
    const key = `${rowId}:${column}`;
    setEditingCells(new Set([key]));
    setSelectedCells(new Set([key]));
  }, []);

  const isCellSelected = useCallback((rowId: string, column: string): boolean => {
    const key = `${rowId}:${column}`;
    return selectedCells.has(key);
  }, [selectedCells]);

  const handleFinishCellEdit = useCallback((rowId: string, column: string) => {
    const key = `${rowId}:${column}`;
    setEditingCells((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleFinishAllEditing = useCallback(() => {
    setEditingCells(new Set());
  }, []);

  const isCellEditing = useCallback((rowId: string, column: string): boolean => {
    const key = `${rowId}:${column}`;
    return editingCells.has(key);
  }, [editingCells]);

  const handleCellEdit = useCallback((rowId: string, column: string, value: string, originalValue: unknown) => {
    const key = `${rowId}:${column}`;
    setDrafts((prev) => {
      const next = new Map(prev);
      if (value === String(originalValue ?? "")) {
        next.delete(key);
      } else {
        next.set(key, { rowId, column, value, originalValue });
      }
      return next;
    });
  }, []);

  const handleDiscardDraft = useCallback((rowId: string, column: string) => {
    const key = `${rowId}:${column}`;
    setDrafts((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleDiscardAllDrafts = useCallback(() => {
    setDrafts(new Map());
    setNewRows([]);
  }, []);

  const getDraftValue = useCallback((rowId: string, column: string): string | null => {
    const key = `${rowId}:${column}`;
    const draft = drafts.get(key);
    return draft ? draft.value : null;
  }, [drafts]);

  const handleAddRecord = useCallback(() => {
    const newRow: TableRow = { id: `new-${Date.now()}` };
    columns.forEach((col) => {
      if (col.name !== "id") {
        newRow[col.name] = null;
      }
    });
    setNewRows((prev) => [newRow, ...prev]);
    columns.forEach((col) => {
      const key = `new-${Date.now()}:${col.name}`;
      setDrafts((prev) => new Map(prev).set(key, {
        rowId: String(newRow.id),
        column: col.name,
        value: "",
        originalValue: null,
      }));
    });
  }, [columns]);

  const handleColumnResize = useCallback((column: string, width: number) => {
    setColumnWidths((prev) => {
      const next = new Map(prev);
      next.set(column, width);
      return next;
    });
  }, []);

  const handleColumnDoubleClickResize = useCallback((column: string) => {
    setColumnWidths((prev) => {
      const next = new Map(prev);
      next.delete(column);
      return next;
    });
  }, []);

  const getColumnWidth = useCallback((column: string): number => {
    return columnWidths.get(column) || 180;
  }, [columnWidths]);

  const hasDrafts = drafts.size > 0 || newRows.length > 0;
  const draftCount = drafts.size;

  return {
    tables,
    selectedTable,
    searchQuery,
    showTables,
    showViews,
    columns,
    displayColumns,
    rows,
    filters,
    sortConfig,
    selectedRows,
    visibleColumns,
    drafts,
    hasDrafts,
    draftCount,
    selectedCells,
    setSearchQuery,
    setShowTables,
    setShowViews,
    handleSelectTable,
    handleToggleColumn,
    handleToggleAllColumns,
    handleAddFilter,
    handleRemoveFilter,
    handleUpdateFilter,
    handleSort,
    handleRowClick,
    handleToggleRow,
    handleSelectAllRows,
    handleCellClick,
    handleCellDoubleClick,
    handleFinishCellEdit,
    handleFinishAllEditing,
    isCellEditing,
    isCellSelected,
    handleCellEdit,
    handleDiscardDraft,
    handleDiscardAllDrafts,
    getDraftValue,
    handleAddRecord,
    handleColumnResize,
    handleColumnDoubleClickResize,
    getColumnWidth,
  };
}
