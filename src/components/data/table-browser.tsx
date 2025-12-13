'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CellFormatter } from '@/core/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    X,
    RefreshCw,
    Play,
    Check,
    AlertCircle,
    Edit3,
    Undo2,
    Loader2,
    Eye
} from 'lucide-react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

type SortDirection = 'asc' | 'desc' | null

type ColumnFilter = {
    column: string
    value: string
    operator: 'contains' | 'equals' | 'starts' | 'ends' | 'gt' | 'lt' | 'gte' | 'lte'
}

type CellEdit = {
    rowIndex: number
    columnIndex: number
    originalValue: unknown
    newValue: string
}

type PendingChange = {
    rowIndex: number
    columnName: string
    originalValue: unknown
    newValue: string
    primaryKeyColumn: string
    primaryKeyValue: unknown
}

type TableBrowserProps = {
    tableName: string
    schema: string
    connectionId: string
    columns: string[]
    data: unknown[][]
    primaryKeyColumn?: string
    onRefresh?: () => void
    onExecuteUpdate?: (sql: string) => Promise<{ success: boolean; error?: string }>
    loading?: boolean
    totalRows?: number
}

export function TableBrowser({
    tableName,
    schema,
    connectionId,
    columns,
    data,
    primaryKeyColumn,
    onRefresh,
    onExecuteUpdate,
    loading = false,
    totalRows,
}: TableBrowserProps) {
    const [sortColumn, setSortColumn] = useState<number | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [filters, setFilters] = useState<ColumnFilter[]>([])
    const [activeFilterColumn, setActiveFilterColumn] = useState<number | null>(null)
    const [filterValue, setFilterValue] = useState('')
    const [filterOperator, setFilterOperator] = useState<ColumnFilter['operator']>('contains')

    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
    const [editValue, setEditValue] = useState('')
    const [pendingChanges, setPendingChanges] = useState<Map<string, CellEdit>>(new Map())
    const [dryRunMode, setDryRunMode] = useState(true)
    const [showDryRunPreview, setShowDryRunPreview] = useState(false)
    const [executingChanges, setExecutingChanges] = useState(false)
    const [lastExecutionResult, setLastExecutionResult] = useState<{ success: boolean; message: string } | null>(null)

    const editInputRef = useRef<HTMLInputElement>(null)
    const pageSize = 100

    // Detect primary key column (typically 'id' or first column)
    const detectedPrimaryKey = primaryKeyColumn || columns.find(c =>
        c.toLowerCase() === 'id' ||
        c.toLowerCase().endsWith('_id') ||
        c.toLowerCase() === 'uuid'
    ) || columns[0]

    const primaryKeyIndex = columns.indexOf(detectedPrimaryKey)

    // Apply filters
    const filteredData = useMemo(() => {
        if (filters.length === 0) return data

        return data.filter(row => {
            return filters.every(filter => {
                const colIndex = columns.indexOf(filter.column)
                if (colIndex === -1) return true

                const cellValue = row[colIndex]
                if (cellValue === null || cellValue === undefined) return false

                const cellStr = String(cellValue).toLowerCase()
                const filterStr = filter.value.toLowerCase()

                switch (filter.operator) {
                    case 'contains':
                        return cellStr.includes(filterStr)
                    case 'equals':
                        return cellStr === filterStr
                    case 'starts':
                        return cellStr.startsWith(filterStr)
                    case 'ends':
                        return cellStr.endsWith(filterStr)
                    case 'gt':
                        return Number(cellValue) > Number(filter.value)
                    case 'lt':
                        return Number(cellValue) < Number(filter.value)
                    case 'gte':
                        return Number(cellValue) >= Number(filter.value)
                    case 'lte':
                        return Number(cellValue) <= Number(filter.value)
                    default:
                        return true
                }
            })
        })
    }, [data, filters, columns])

    // Apply sorting
    const sortedData = useMemo(() => {
        if (sortColumn === null || !sortDirection) return filteredData

        return [...filteredData].sort((a, b) => {
            const aValue = a[sortColumn]
            const bValue = b[sortColumn]

            if (aValue === null && bValue === null) return 0
            if (aValue === null) return 1
            if (bValue === null) return -1

            let comparison = 0
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue
            } else if (aValue instanceof Date && bValue instanceof Date) {
                comparison = aValue.getTime() - bValue.getTime()
            } else {
                const aStr = String(aValue).toLowerCase()
                const bStr = String(bValue).toLowerCase()
                comparison = aStr.localeCompare(bStr)
            }

            return sortDirection === 'asc' ? comparison : -comparison
        })
    }, [filteredData, sortColumn, sortDirection])

    // Paginate
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize
        const endIndex = startIndex + pageSize
        return sortedData.slice(startIndex, endIndex)
    }, [sortedData, currentPage])

    const totalPages = Math.ceil(sortedData.length / pageSize)

    // Handle sort
    const handleSort = (columnIndex: number) => {
        setCurrentPage(1)

        if (sortColumn === columnIndex) {
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortColumn(null)
                setSortDirection(null)
            }
        } else {
            setSortColumn(columnIndex)
            setSortDirection('asc')
        }
    }

    // Add filter
    const addFilter = (columnIndex: number) => {
        if (!filterValue.trim()) return

        const newFilter: ColumnFilter = {
            column: columns[columnIndex],
            value: filterValue.trim(),
            operator: filterOperator,
        }

        setFilters(prev => [...prev.filter(f => f.column !== columns[columnIndex]), newFilter])
        setFilterValue('')
        setActiveFilterColumn(null)
        setCurrentPage(1)
    }

    // Remove filter
    const removeFilter = (column: string) => {
        setFilters(prev => prev.filter(f => f.column !== column))
        setCurrentPage(1)
    }

    // Start editing a cell
    const startEditing = (rowIndex: number, colIndex: number, currentValue: unknown) => {
        if (colIndex === primaryKeyIndex) return // Don't allow editing primary key

        const dataRowIndex = (currentPage - 1) * pageSize + rowIndex
        const cellKey = `${dataRowIndex}-${colIndex}`

        // Check if there's already a pending change for this cell
        const existingEdit = pendingChanges.get(cellKey)
        const valueToEdit = existingEdit ? existingEdit.newValue : String(currentValue ?? '')

        setEditingCell({ row: rowIndex, col: colIndex })
        setEditValue(valueToEdit)

        setTimeout(() => editInputRef.current?.focus(), 0)
    }

    // Save cell edit
    const saveEdit = () => {
        if (!editingCell) return

        const dataRowIndex = (currentPage - 1) * pageSize + editingCell.row
        const originalValue = sortedData[dataRowIndex]?.[editingCell.col]
        const cellKey = `${dataRowIndex}-${editingCell.col}`

        // Check if value actually changed
        const existingEdit = pendingChanges.get(cellKey)
        const originalValueToCompare = existingEdit ? existingEdit.originalValue : originalValue

        if (String(originalValueToCompare ?? '') !== editValue) {
            setPendingChanges(prev => {
                const next = new Map(prev)
                next.set(cellKey, {
                    rowIndex: dataRowIndex,
                    columnIndex: editingCell.col,
                    originalValue: originalValueToCompare,
                    newValue: editValue,
                })
                return next
            })
        } else {
            // Value is back to original, remove pending change
            setPendingChanges(prev => {
                const next = new Map(prev)
                next.delete(cellKey)
                return next
            })
        }

        setEditingCell(null)
        setEditValue('')
    }

    // Cancel edit
    const cancelEdit = () => {
        setEditingCell(null)
        setEditValue('')
    }

    // Discard a specific change
    const discardChange = (cellKey: string) => {
        setPendingChanges(prev => {
            const next = new Map(prev)
            next.delete(cellKey)
            return next
        })
    }

    // Discard all changes
    const discardAllChanges = () => {
        setPendingChanges(new Map())
        setLastExecutionResult(null)
    }

    // Generate SQL for pending changes
    const generateUpdateSQL = useCallback((): string[] => {
        const statements: string[] = []
        const tableRef = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`

        pendingChanges.forEach((edit) => {
            const row = sortedData[edit.rowIndex]
            if (!row) return

            const pkValue = row[primaryKeyIndex]
            const columnName = columns[edit.columnIndex]

            // Format value for SQL
            let formattedValue: string
            if (edit.newValue === '' || edit.newValue.toLowerCase() === 'null') {
                formattedValue = 'NULL'
            } else if (isNaN(Number(edit.newValue))) {
                formattedValue = `'${edit.newValue.replace(/'/g, "''")}'`
            } else {
                formattedValue = edit.newValue
            }

            // Format primary key value
            let formattedPkValue: string
            if (typeof pkValue === 'string') {
                formattedPkValue = `'${pkValue.replace(/'/g, "''")}'`
            } else {
                formattedPkValue = String(pkValue)
            }

            statements.push(
                `UPDATE ${tableRef} SET "${columnName}" = ${formattedValue} WHERE "${detectedPrimaryKey}" = ${formattedPkValue};`
            )
        })

        return statements
    }, [pendingChanges, sortedData, primaryKeyIndex, columns, schema, tableName, detectedPrimaryKey])

    // Execute changes
    const executeChanges = async () => {
        if (!onExecuteUpdate || pendingChanges.size === 0) return

        setExecutingChanges(true)
        setLastExecutionResult(null)

        try {
            const statements = generateUpdateSQL()
            const combinedSQL = statements.join('\n')

            const result = await onExecuteUpdate(combinedSQL)

            if (result.success) {
                setLastExecutionResult({ success: true, message: `Successfully updated ${pendingChanges.size} cell(s)` })
                setPendingChanges(new Map())
                onRefresh?.()
            } else {
                setLastExecutionResult({ success: false, message: result.error || 'Update failed' })
            }
        } catch (error) {
            setLastExecutionResult({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        } finally {
            setExecutingChanges(false)
        }
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            saveEdit()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            cancelEdit()
        } else if (e.key === 'Tab') {
            e.preventDefault()
            saveEdit()

            // Move to next cell
            if (editingCell) {
                const nextCol = e.shiftKey ? editingCell.col - 1 : editingCell.col + 1
                if (nextCol >= 0 && nextCol < columns.length && nextCol !== primaryKeyIndex) {
                    const value = paginatedData[editingCell.row]?.[nextCol]
                    startEditing(editingCell.row, nextCol, value)
                }
            }
        }
    }

    // Copy cell value
    async function copyCellValue(value: unknown) {
        try {
            const formatted = CellFormatter.formatCellForCopy(value)
            await navigator.clipboard.writeText(formatted)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    function getSortIcon(columnIndex: number) {
        if (sortColumn !== columnIndex) {
            return <ArrowUpDown className="h-3 w-3 opacity-50" />
        }
        if (sortDirection === 'asc') {
            return <ArrowUp className="h-3 w-3" />
        }
        if (sortDirection === 'desc') {
            return <ArrowDown className="h-3 w-3" />
        }
        return <ArrowUpDown className="h-3 w-3 opacity-50" />
    }

    function goToPage(page: number) {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

    // Export functions (same as before)
    function exportToCSV() {
        const csvContent = [
            columns.join(','),
            ...sortedData.map(row =>
                row.map(cell => {
                    const value = cell === null ? 'NULL' : String(cell)
                    if (value.includes(',') || value.includes('"')) {
                        return `"${value.replace(/"/g, '""')}"`
                    }
                    return value
                }).join(',')
            )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${tableName}_${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    function exportToJSON() {
        const jsonData = sortedData.map(row => {
            const obj: Record<string, unknown> = {}
            columns.forEach((col, index) => {
                obj[col] = row[index]
            })
            return obj
        })

        const jsonContent = JSON.stringify(jsonData, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${tableName}_${new Date().toISOString().slice(0, 10)}.json`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Get display value for a cell (considering pending changes)
    const getCellDisplayValue = (dataRowIndex: number, colIndex: number, originalValue: unknown): unknown => {
        const cellKey = `${dataRowIndex}-${colIndex}`
        const pendingEdit = pendingChanges.get(cellKey)
        return pendingEdit ? pendingEdit.newValue : originalValue
    }

    // Check if cell has pending changes
    const hasPendingChange = (dataRowIndex: number, colIndex: number): boolean => {
        const cellKey = `${dataRowIndex}-${colIndex}`
        return pendingChanges.has(cellKey)
    }

    const sqlPreview = generateUpdateSQL()

    return (
        <div className="h-full w-full flex flex-col bg-card">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                            {schema ? `${schema}.${tableName}` : tableName}
                        </span>
                        {totalRows !== undefined && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {totalRows.toLocaleString()} rows
                            </span>
                        )}
                    </div>

                    {/* Active filters */}
                    {filters.length > 0 && (
                        <div className="flex items-center gap-1">
                            {filters.map(filter => (
                                <div
                                    key={filter.column}
                                    className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-xs"
                                >
                                    <span className="font-medium">{filter.column}</span>
                                    <span className="opacity-70">{filter.operator}</span>
                                    <span>"{filter.value}"</span>
                                    <button
                                        onClick={() => removeFilter(filter.column)}
                                        className="hover:bg-primary/20 rounded p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Pending changes indicator */}
                    {pendingChanges.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-warning font-medium">
                                {pendingChanges.size} pending change{pendingChanges.size > 1 ? 's' : ''}
                            </span>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={discardAllChanges}
                                className="h-7 text-xs"
                            >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Discard
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDryRunPreview(!showDryRunPreview)}
                                className="h-7 text-xs"
                            >
                                <Eye className="h-3 w-3 mr-1" />
                                Preview SQL
                            </Button>

                            <Button
                                size="sm"
                                onClick={executeChanges}
                                disabled={executingChanges || !onExecuteUpdate}
                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            >
                                {executingChanges ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                    <Play className="h-3 w-3 mr-1" />
                                )}
                                Apply Changes
                            </Button>
                        </div>
                    )}

                    {/* Dry run toggle */}
                    <Button
                        variant={dryRunMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDryRunMode(!dryRunMode)}
                        className="h-7 text-xs"
                        title="When enabled, changes are previewed but not automatically applied"
                    >
                        <Edit3 className="h-3 w-3 mr-1" />
                        {dryRunMode ? 'Dry Run: ON' : 'Dry Run: OFF'}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={loading}
                        className="h-7"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Execution result banner */}
            {lastExecutionResult && (
                <div className={`px-4 py-2 text-sm flex items-center gap-2 ${lastExecutionResult.success
                    ? 'bg-green-500/10 text-green-500 border-b border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border-b border-red-500/20'
                    }`}
                >
                    {lastExecutionResult.success ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    {lastExecutionResult.message}
                    <button
                        onClick={() => setLastExecutionResult(null)}
                        className="ml-auto hover:opacity-70"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Dry run SQL preview */}
            {showDryRunPreview && pendingChanges.size > 0 && (
                <div className="border-b border-border bg-muted/50 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground">SQL Preview</span>
                        <button
                            onClick={() => setShowDryRunPreview(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="bg-background rounded border border-border p-3 max-h-40 overflow-auto">
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                            {sqlPreview.join('\n')}
                        </pre>
                    </div>
                </div>
            )}

            {/* Table content */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <div className="font-medium">Loading data...</div>
                        </div>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 bg-card border-b border-border z-10">
                            <tr>
                                {columns.map((column, index) => {
                                    const hasFilter = filters.some(f => f.column === column)
                                    const isPrimaryKey = index === primaryKeyIndex

                                    return (
                                        <th
                                            key={index}
                                            className={`px-4 py-2 text-left font-semibold text-foreground border-r border-border/30 last:border-r-0 ${isPrimaryKey ? 'bg-muted/50' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                                    onClick={() => handleSort(index)}
                                                >
                                                    <span className="mr-1">{column}</span>
                                                    {isPrimaryKey && (
                                                        <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">PK</span>
                                                    )}
                                                    {getSortIcon(index)}
                                                </Button>

                                                {/* Filter popover */}
                                                <Popover
                                                    open={activeFilterColumn === index}
                                                    onOpenChange={(open: boolean) => {
                                                        if (open) {
                                                            setActiveFilterColumn(index)
                                                            setFilterValue('')
                                                        } else {
                                                            setActiveFilterColumn(null)
                                                        }
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            className={`p-1 rounded hover:bg-muted transition-colors ${hasFilter ? 'text-primary' : 'text-muted-foreground opacity-50 hover:opacity-100'
                                                                }`}
                                                        >
                                                            <Filter className="h-3 w-3" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3" align="start">
                                                        <div className="space-y-2">
                                                            <select
                                                                value={filterOperator}
                                                                onChange={(e) => setFilterOperator(e.target.value as ColumnFilter['operator'])}
                                                                className="w-full h-8 rounded border border-border bg-background px-2 text-sm"
                                                            >
                                                                <option value="contains">Contains</option>
                                                                <option value="equals">Equals</option>
                                                                <option value="starts">Starts with</option>
                                                                <option value="ends">Ends with</option>
                                                                <option value="gt">Greater than</option>
                                                                <option value="lt">Less than</option>
                                                                <option value="gte">Greater or equal</option>
                                                                <option value="lte">Less or equal</option>
                                                            </select>
                                                            <Input
                                                                value={filterValue}
                                                                onChange={(e) => setFilterValue(e.target.value)}
                                                                placeholder="Filter value..."
                                                                className="h-8"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        addFilter(index)
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => addFilter(index)}
                                                                    className="flex-1 h-7"
                                                                >
                                                                    Apply
                                                                </Button>
                                                                {hasFilter && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => removeFilter(column)}
                                                                        className="h-7"
                                                                    >
                                                                        Clear
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row, rowIndex) => {
                                const dataRowIndex = (currentPage - 1) * pageSize + rowIndex

                                return (
                                    <tr
                                        key={rowIndex}
                                        className="border-b border-border hover:bg-accent/50 transition-colors"
                                    >
                                        {row.map((cell, cellIndex) => {
                                            const isPrimaryKey = cellIndex === primaryKeyIndex
                                            const isEditing = editingCell?.row === rowIndex && editingCell?.col === cellIndex
                                            const hasChange = hasPendingChange(dataRowIndex, cellIndex)
                                            const displayValue = getCellDisplayValue(dataRowIndex, cellIndex, cell)
                                            const cellType = CellFormatter.getCellType(displayValue)

                                            return (
                                                <td
                                                    key={cellIndex}
                                                    className={`px-4 py-2 border-r border-border/30 last:border-r-0 ${isPrimaryKey
                                                        ? 'bg-muted/30 cursor-default'
                                                        : 'cursor-pointer hover:bg-muted/50'
                                                        } ${hasChange ? 'bg-yellow-500/10' : ''}`}
                                                    onClick={() => {
                                                        if (!isEditing && !isPrimaryKey) {
                                                            copyCellValue(displayValue)
                                                        }
                                                    }}
                                                    onDoubleClick={() => {
                                                        if (!isPrimaryKey) {
                                                            startEditing(rowIndex, cellIndex, cell)
                                                        }
                                                    }}
                                                    title={isPrimaryKey ? 'Primary key (read-only)' : CellFormatter.formatCellTitle(displayValue)}
                                                >
                                                    {isEditing ? (
                                                        <input
                                                            ref={editInputRef}
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            onBlur={saveEdit}
                                                            className="w-full h-6 px-1 bg-background border border-blue-500 rounded text-sm focus:outline-none"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span
                                                            className={`${cellType === 'null'
                                                                ? 'text-muted-foreground italic'
                                                                : cellType === 'number'
                                                                    ? 'text-primary'
                                                                    : cellType === 'boolean'
                                                                        ? 'text-warning'
                                                                        : cellType === 'object'
                                                                            ? 'text-success'
                                                                            : ''
                                                                } ${hasChange ? 'font-medium text-yellow-600 dark:text-yellow-400' : ''}`}
                                                        >
                                                            {CellFormatter.formatCellDisplay(displayValue as never)}
                                                            {hasChange && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        discardChange(`${dataRowIndex}-${cellIndex}`)
                                                                    }}
                                                                    className="ml-1 text-muted-foreground hover:text-foreground"
                                                                    title="Discard change"
                                                                >
                                                                    <Undo2 className="h-3 w-3 inline" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}

                {!loading && paginatedData.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        No results
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {(totalPages > 1 || sortedData.length > 0) && !loading && (
                <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                            <div className="text-muted-foreground">
                                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
                                {filters.length > 0 && data.length !== sortedData.length && (
                                    <span className="ml-1 text-primary">
                                        (filtered from {data.length})
                                    </span>
                                )}
                            </div>

                            {/* Export Controls */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportToCSV}
                                    disabled={sortedData.length === 0}
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportToJSON}
                                    disabled={sortedData.length === 0}
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    JSON
                                </Button>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum
                                        if (totalPages <= 5) {
                                            pageNum = i + 1
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i
                                        } else {
                                            pageNum = currentPage - 2 + i
                                        }

                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => goToPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        )
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
