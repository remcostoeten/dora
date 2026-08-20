'use client'

import { AnimatePresence, m } from 'framer-motion'
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Ban,
    BarChart3,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Columns3,
    Copy,
    CopyPlus,
    Download,
    Edit3,
    FileJson,
    Filter,
    Pencil,
    Plus,
    RefreshCw,
    PanelLeft,
    Save,
    Search,
    Table as TableIcon,
    Trash2,
    X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
    copyText,
    exportRows,
    rowsToInsert,
    rowsToJson,
    rowsToTsv
} from '@/components/hero-app-demo-export'
import {
    activeConditions,
    FilterBar,
    rowPasses,
    type TConjunction,
    type TFilterCondition
} from '@/components/hero-app-demo-filter-bar'
import {
    DemoContextMenu,
    DemoDialog,
    DemoSelect,
    DialogButton,
    type TMenuEntry,
    useDismiss
} from '@/components/hero-app-demo-menus'
import {
    type TDemoColumn,
    type TDemoTable
} from '@/components/hero-app-demo-tables'

/**
 * The interactive heart of the hero demo: everything below the table tabs.
 * Faithful to the real studio's data-grid surface — sort cycling, column
 * resize + visibility, filter builder, keyboard navigation, context menus,
 * dry-edit staging, pagination and export — but fully in-memory.
 */

type TVisibleColumn = { column: TDemoColumn; index: number }

type TSort = { column: string; dir: 'asc' | 'desc' } | null

type TWorkspaceView = 'table' | 'json' | 'chart'

type TMenuState = {
    kind: 'cell' | 'row'
    x: number
    y: number
    rowId: string
    colIndex: number
}

const MENU_WIDTH = 188

function GridCheckbox({
    active,
    onClick,
    onContextMenu
}: {
    active?: boolean
    onClick?: () => void
    onContextMenu?: (event: React.MouseEvent) => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onContextMenu={onContextMenu}
            className="flex items-center justify-center border-b border-r border-sidebar-border bg-background transition-colors hover:bg-sidebar-accent/50"
        >
            <span
                className={
                    'h-3.5 w-3.5 rounded-[2px] border transition-colors ' +
                    (active
                        ? 'border-primary bg-primary shadow-[inset_0_0_0_3px_var(--background)]'
                        : 'border-muted-foreground/40')
                }
            />
        </button>
    )
}

function cellTone(column: TDemoColumn, cell: string): string {
    if (!cell) return 'italic text-muted-foreground/60'
    if (column.kind === 'pk') return 'text-right text-primary/80 tabular-nums'
    if (column.kind === 'fk') return 'text-blue-400/80 tabular-nums'
    if (
        column.kind === 'number' ||
        column.kind === 'money' ||
        column.kind === 'date'
    ) {
        return 'text-foreground/90 tabular-nums'
    }
    return 'text-foreground/90'
}

function TableRow({
    row,
    rowIndex,
    visibleColumns,
    template,
    selectedRows,
    selectedCell,
    editingCell,
    stagedCells,
    deletingRows,
    onRowSelect,
    onCellSelect,
    onEditStart,
    onEditCommit,
    onEditCancel,
    onCellMenu,
    onRowMenu
}: {
    row: string[]
    rowIndex: number
    visibleColumns: TVisibleColumn[]
    template: string
    selectedRows: string[]
    selectedCell: string
    editingCell: string | null
    stagedCells: string[]
    deletingRows: Map<string, number>
    onRowSelect: (id: string) => void
    onCellSelect: (cell: string) => void
    onEditStart: (cell: string) => void
    onEditCommit: (cell: string, value: string) => void
    onEditCancel: () => void
    onCellMenu: (event: React.MouseEvent, rowId: string, col: number) => void
    onRowMenu: (event: React.MouseEvent, rowId: string) => void
}) {
    const rowSelected = selectedRows.includes(row[0])
    const isDeleting = deletingRows.has(row[0])
    const deleteIndex = deletingRows.get(row[0]) ?? -1

    function renderCell(visible: TVisibleColumn) {
        const { column, index: cellIndex } = visible
        const cell = row[cellIndex]
        const cellId = row[0] + ':' + cellIndex
        const editable = column.kind !== 'pk'

        if (editingCell === cellId) {
            return (
                <div
                    key={column.name}
                    className="relative border-b border-r border-sidebar-border bg-background"
                >
                    <input
                        autoFocus
                        defaultValue={cell}
                        onFocus={(event) => event.target.select()}
                        onBlur={(event) => {
                            if (event.target.dataset.cancelled) {
                                onEditCancel()
                                return
                            }
                            onEditCommit(cellId, event.target.value)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.currentTarget.blur()
                            }
                            if (event.key === 'Escape') {
                                event.currentTarget.dataset.cancelled = '1'
                                event.currentTarget.blur()
                            }
                        }}
                        className="h-full w-full bg-transparent px-3 py-1.5 text-left text-foreground outline-none ring-1 ring-inset ring-primary/60"
                    />
                </div>
            )
        }

        const isStaged = stagedCells.includes(cellId)
        const focused = selectedCell === cellId
        const staged = isStaged
            ? ' relative bg-amber-500/10 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.4)]'
            : ''
        const focus =
            focused && !isStaged
                ? ' relative bg-sidebar-accent/35 shadow-[inset_0_0_0_1px_hsl(0_0%_86%/0.35)]'
                : ''
        const base =
            'overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-sidebar-border px-3 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50 '

        let content: ReactNode = cell || 'NULL'
        if (cell && column.kind === 'date') {
            const [datePart, timePart] = cell.split(' ')
            content = (
                <>
                    {datePart}{' '}
                    {timePart && (
                        <span className="text-muted-foreground/60">
                            {timePart}
                        </span>
                    )}
                </>
            )
        }

        return (
            <button
                type="button"
                key={column.name}
                onClick={() => onCellSelect(cellId)}
                onDoubleClick={() => {
                    if (editable) onEditStart(cellId)
                }}
                onContextMenu={(event) => onCellMenu(event, row[0], cellIndex)}
                title={editable ? 'Double-click to edit' : undefined}
                className={base + cellTone(column, cell) + focus + staged}
            >
                {content}
            </button>
        )
    }

    return (
        <m.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
                opacity: 0,
                x: 48,
                scaleY: 0.82,
                filter: 'blur(8px)',
                height: 0,
                overflow: 'hidden',
                transition: {
                    duration: 0.26,
                    ease: [0.23, 1, 0.32, 1],
                    delay: deleteIndex >= 0 ? deleteIndex * 0.065 : 0
                }
            }}
            transition={{
                default: {
                    type: 'spring',
                    duration: 0.4,
                    bounce: 0.22
                },
                layout: { type: 'spring', duration: 0.35, bounce: 0.15 }
            }}
            style={{ gridTemplateColumns: template }}
            className={
                'group relative grid ' +
                (rowSelected
                    ? 'bg-primary/10'
                    : (rowIndex % 2 === 1 ? 'bg-muted/35 ' : '') +
                      'hover:bg-sidebar-accent/30')
            }
        >
            <AnimatePresence>
                {isDeleting && (
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.08 }}
                        className="pointer-events-none absolute inset-0 z-10 bg-red-500/10 ring-1 ring-inset ring-red-500/20"
                    />
                )}
            </AnimatePresence>
            <GridCheckbox
                active={rowSelected}
                onClick={() => onRowSelect(row[0])}
                onContextMenu={(event) => onRowMenu(event, row[0])}
            />
            {visibleColumns.map(renderCell)}
        </m.div>
    )
}

function GhostButton({
    icon: Icon,
    label,
    active,
    badge,
    onClick
}: {
    icon: LucideIcon
    label: string
    active?: boolean
    badge?: number
    onClick?: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'inline-flex h-6 items-center gap-1.5 rounded-[2px] px-1.5 text-[11px] whitespace-nowrap transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground ' +
                (active
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-muted-foreground')
            }
        >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold tabular-nums text-primary-foreground">
                    {badge}
                </span>
            )}
        </button>
    )
}

function ShortcutBadge({ children }: { children: ReactNode }) {
    return (
        <span
            className="ml-1 hidden lg:inline-flex h-4.5 min-w-[20px] items-center justify-center rounded-md border border-border/60 bg-muted/40 px-1 font-sans text-[9px] font-medium text-muted-foreground/80 tracking-tight"
            aria-hidden="true"
        >
            {children}
        </span>
    )
}

function BarButton({
    icon: Icon,
    label,
    shortcut,
    tone,
    onClick
}: {
    icon: LucideIcon
    label: string
    shortcut?: string
    tone?: 'muted' | 'destructive' | 'emerald'
    onClick?: () => void
}) {
    const toneClass =
        tone === 'destructive'
            ? 'text-destructive bg-destructive/[0.08] hover:bg-destructive/[0.15] dark:text-red-400'
            : tone === 'emerald'
              ? 'text-emerald-400 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.15]'
              : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]'
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium h-7 px-2.5 shrink-0 transition-[color,background-color,transform] duration-150 active:scale-[0.97] ' +
                toneClass
            }
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
            {shortcut && <ShortcutBadge>{shortcut}</ShortcutBadge>}
        </button>
    )
}

/** Synthesises a plausible new record for `table` from its column kinds, so
 *  "Add record" produces a row that fits the schema rather than a customer. */
function draftRecord(table: TDemoTable, id: string): string[] {
    return table.columns.map((column, index) => {
        if (index === 0) return id
        if (column.kind === 'fk') return String((Number(id) % 12) + 1)
        if (column.kind === 'money') return '0.00'
        if (column.kind === 'number') return '0'
        if (column.kind === 'date') {
            return column.type === 'date' ? '2026-04-01' : '2026-04-01 12:00:00'
        }
        return 'draft_' + id
    })
}

function BulkEditDialog({
    columns,
    count,
    onApply,
    onClose
}: {
    columns: TDemoColumn[]
    count: number
    onApply: (column: string, value: string) => void
    onClose: () => void
}) {
    const editable = columns.filter((column) => column.kind !== 'pk')
    const [column, setColumn] = useState(editable[0]?.name ?? '')
    const [value, setValue] = useState('')

    return (
        <DemoDialog
            title={'Bulk edit ' + count + ' row' + (count === 1 ? '' : 's')}
            onClose={onClose}
            footer={
                <>
                    <DialogButton label="Cancel" onClick={onClose} />
                    <DialogButton
                        label="Apply"
                        primary
                        onClick={() => {
                            onApply(column, value)
                            onClose()
                        }}
                    />
                </>
            }
        >
            <label className="text-[11px] text-muted-foreground">Column</label>
            <DemoSelect
                value={column}
                ariaLabel="Column to edit"
                options={editable.map((entry) => ({
                    value: entry.name,
                    label: entry.name
                }))}
                onChange={setColumn}
            />
            <label className="text-[11px] text-muted-foreground">
                New value
            </label>
            <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Enter new value (leave empty for NULL)"
                className="h-7 rounded-[2px] border border-input bg-background/40 px-2 text-[11px] text-sidebar-foreground outline-hidden placeholder:text-muted-foreground/60 focus:border-sidebar-border"
            />
        </DemoDialog>
    )
}

function SetNullDialog({
    columns,
    count,
    onApply,
    onClose
}: {
    columns: TDemoColumn[]
    count: number
    onApply: (column: string) => void
    onClose: () => void
}) {
    const editable = columns.filter((column) => column.kind !== 'pk')
    const [column, setColumn] = useState(editable[0]?.name ?? '')

    return (
        <DemoDialog
            title="Set column to NULL"
            onClose={onClose}
            footer={
                <>
                    <DialogButton label="Cancel" onClick={onClose} />
                    <DialogButton
                        label={
                            'Set NULL (' +
                            count +
                            ' row' +
                            (count === 1 ? '' : 's') +
                            ')'
                        }
                        primary
                        onClick={() => {
                            onApply(column)
                            onClose()
                        }}
                    />
                </>
            }
        >
            <label className="text-[11px] text-muted-foreground">Column</label>
            <DemoSelect
                value={column}
                ariaLabel="Column to clear"
                options={editable.map((entry) => ({
                    value: entry.name,
                    label: entry.name
                }))}
                onChange={setColumn}
            />
        </DemoDialog>
    )
}

/** Div-based mini bar chart standing in for the real Chart View: sums the
 *  first numeric column per row, or falls back to group-by counts. */
function ChartView({ table, rows }: { table: TDemoTable; rows: string[][] }) {
    const valueIndex = table.columns.findIndex(
        (column) => column.kind === 'money' || column.kind === 'number'
    )
    const textColumns = table.columns.filter((column) => column.kind === 'text')
    const labelIndex =
        valueIndex >= 0
            ? table.columns.findIndex((column) => column.kind === 'text')
            : table.columns.indexOf(textColumns[textColumns.length - 1])

    let bars: { label: string; value: number }[]
    let title: string
    if (valueIndex >= 0) {
        title =
            table.columns[valueIndex].name +
            ' by ' +
            (labelIndex >= 0 ? table.columns[labelIndex].name : 'id')
        bars = rows.map((row) => ({
            label:
                labelIndex >= 0
                    ? row[labelIndex] || '#' + row[0]
                    : '#' + row[0],
            value: Number(row[valueIndex]) || 0
        }))
    } else {
        title = 'COUNT(*) by ' + table.columns[labelIndex]?.name
        const counts = new Map<string, number>()
        for (const row of rows) {
            const key = row[labelIndex] || 'NULL'
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        bars = [...counts.entries()].map(([label, value]) => ({
            label,
            value
        }))
    }
    bars = bars.toSorted((a, b) => b.value - a.value).slice(0, 8)
    const max = Math.max(1, ...bars.map((bar) => bar.value))

    return (
        <div className="flex h-full flex-col bg-background px-4 py-3">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {title}
            </div>
            <div className="flex flex-col gap-2">
                {bars.map((bar) => (
                    <div key={bar.label} className="flex items-center gap-2">
                        <span className="w-[120px] shrink-0 truncate text-right font-mono text-[11px] text-muted-foreground">
                            {bar.label}
                        </span>
                        <div className="h-4 flex-1">
                            <m.div
                                initial={{ width: 0 }}
                                animate={{
                                    width: (bar.value / max) * 100 + '%'
                                }}
                                transition={{
                                    type: 'spring',
                                    duration: 0.6,
                                    bounce: 0.1
                                }}
                                className="h-full rounded-r-[2px] bg-primary/50"
                            />
                        </div>
                        <span className="w-[72px] shrink-0 font-mono text-[11px] tabular-nums text-foreground/80">
                            {bar.value.toLocaleString('en-US')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Faked JSON syntax highlighting for the document view: keys/strings/numbers
 *  get their own tint so the toggle reads like a real code viewer. */
function JsonDocument({
    columns,
    rows
}: {
    columns: TDemoColumn[]
    rows: string[][]
}) {
    const punct = 'text-muted-foreground/70'

    function renderField(column: TDemoColumn, value: string, last: boolean) {
        const isNumber =
            column.kind === 'pk' ||
            column.kind === 'fk' ||
            column.kind === 'number' ||
            column.kind === 'money'
        return (
            <span key={column.name}>
                {'    '}
                <span className="text-syntax-key">
                    &quot;{column.name}&quot;
                </span>
                <span className={punct}>: </span>
                {value === '' ? (
                    <span className="italic text-muted-foreground/60">
                        null
                    </span>
                ) : isNumber ? (
                    <span className="text-syntax-number">{value}</span>
                ) : (
                    <span className="text-syntax-string">
                        &quot;{value}&quot;
                    </span>
                )}
                <span className={punct}>{last ? '' : ','}</span>
                {'\n'}
            </span>
        )
    }

    function renderRecord(row: string[], index: number) {
        return (
            <span key={row[0]}>
                {'  '}
                <span className={punct}>{'{'}</span>
                {'\n'}
                {columns.map((column, columnIndex) =>
                    renderField(
                        column,
                        row[columnIndex],
                        columnIndex === columns.length - 1
                    )
                )}
                {'  '}
                <span className={punct}>
                    {'}'}
                    {index === rows.length - 1 ? '' : ','}
                </span>
                {'\n'}
            </span>
        )
    }

    return (
        <>
            <span className={punct}>[</span>
            {'\n'}
            {rows.map(renderRecord)}
            <span className={punct}>]</span>
        </>
    )
}

export function TableWorkspace({ table }: { table: TDemoTable }) {
    const firstRowId = table.rows[0]?.[0] ?? ''
    const [sourceRows, setSourceRows] = useState(table.rows)
    const [selectedRows, setSelectedRows] = useState<string[]>(
        firstRowId ? [firstRowId] : []
    )
    const [selectedCell, setSelectedCell] = useState(
        firstRowId ? `${firstRowId}:1` : ''
    )
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [staged, setStaged] = useState<Map<string, string>>(new Map())
    const [copied, setCopied] = useState(false)
    const [sort, setSort] = useState<TSort>({ column: 'id', dir: 'asc' })
    const [dryEdit, setDryEdit] = useState(false)
    const [view, setView] = useState<TWorkspaceView>('table')
    const [conditions, setConditions] = useState<TFilterCondition[]>([])
    const [conjunction, setConjunction] = useState<TConjunction>('AND')
    const [showFilters, setShowFilters] = useState(false)
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
    const [resizingColumn, setResizingColumn] = useState<string | null>(null)
    const [columnsOpen, setColumnsOpen] = useState(false)
    const [columnsQuery, setColumnsQuery] = useState('')
    const [exportOpen, setExportOpen] = useState(false)
    const [selectionExportOpen, setSelectionExportOpen] = useState(false)
    const [dialog, setDialog] = useState<'bulk-edit' | 'set-null' | null>(null)
    const [menu, setMenu] = useState<TMenuState | null>(null)
    const [limit, setLimit] = useState(50)
    const [limitText, setLimitText] = useState('50')
    const [offset, setOffset] = useState(0)
    const [offsetText, setOffsetText] = useState('0')
    const [queryMs, setQueryMs] = useState(3)
    const [deletingRows, setDeletingRows] = useState<Map<string, number>>(
        new Map()
    )

    const gridRegionRef = useRef<HTMLDivElement>(null)
    const columnsRef = useRef<HTMLDivElement>(null)
    const exportRef = useRef<HTMLDivElement>(null)
    const selectionExportRef = useRef<HTMLDivElement>(null)
    const resizeSuppressRef = useRef(false)

    useDismiss(columnsRef, columnsOpen, () => setColumnsOpen(false))
    useDismiss(exportRef, exportOpen, () => setExportOpen(false))
    useDismiss(selectionExportRef, selectionExportOpen, () =>
        setSelectionExportOpen(false)
    )

    const visibleColumns: TVisibleColumn[] = table.columns
        .map((column, index) => ({ column, index }))
        .filter(({ column }) => !hiddenColumns.includes(column.name))

    const template =
        '30px ' +
        visibleColumns
            .map(({ column }) =>
                columnWidths[column.name]
                    ? columnWidths[column.name] + 'px'
                    : column.track
            )
            .join(' ')

    const displayRows = useMemo(() => {
        const filtered = sourceRows.filter((row) =>
            rowPasses(conditions, conjunction, table.columns, row)
        )
        if (!sort) return filtered
        const sortIndex = table.columns.findIndex(
            (column) => column.name === sort.column
        )
        if (sortIndex < 0) return filtered
        const sorted = filtered.toSorted((a, b) =>
            a[sortIndex].localeCompare(b[sortIndex], undefined, {
                numeric: true
            })
        )
        return sort.dir === 'asc' ? sorted : sorted.toReversed()
    }, [conditions, conjunction, sort, sourceRows, table])

    const totalRows = displayRows.length
    const pageRows = displayRows.slice(offset, offset + limit)
    const stagedCells = [...staged.keys()]
    const filterCount = activeConditions(conditions).length
    const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(1, limit)))
    const pageNumber = Math.min(pageCount, Math.floor(offset / limit) + 1)

    function setOffsetBoth(next: number) {
        setOffset(next)
        setOffsetText(String(next))
    }

    function toggleRow(id: string) {
        setSelectedRows((current) =>
            current.includes(id)
                ? current.filter((rowId) => rowId !== id)
                : current.concat(id)
        )
    }

    function toggleAllRows() {
        setSelectedRows((current) =>
            current.length === pageRows.length && pageRows.length > 0
                ? []
                : pageRows.map((row) => row[0])
        )
    }

    function maxId(rows: string[][]): number {
        return rows.reduce((max, row) => Math.max(max, Number(row[0]) || 0), 0)
    }

    function addRecord() {
        setSourceRows((current) =>
            current.concat([draftRecord(table, String(maxId(current) + 1))])
        )
        setQueryMs(5)
    }

    function duplicateRows(ids: string[]) {
        setSourceRows((current) => {
            let nextId = maxId(current)
            const clones = current
                .filter((row) => ids.includes(row[0]))
                .map((row) => {
                    nextId += 1
                    return [String(nextId), ...row.slice(1)]
                })
            return current.concat(clones)
        })
        setQueryMs(5)
    }

    function copySelected() {
        copyText(
            rowsToJson(
                table.columns,
                sourceRows.filter((row) => selectedRows.includes(row[0]))
            )
        )
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
    }

    function startEdit(cell: string) {
        setEditingCell(cell)
    }

    function cancelEdit() {
        setEditingCell(null)
    }

    function setCellValues(ids: string[], columnIndex: number, value: string) {
        setSourceRows((current) =>
            current.map((row) =>
                ids.includes(row[0])
                    ? row.map((cell, index) =>
                          index === columnIndex ? value : cell
                      )
                    : row
            )
        )
        setQueryMs(6)
    }

    function commitEdit(cell: string, value: string) {
        const [rowId, columnIndex] = cell.split(':')
        if (dryEdit) {
            const original =
                sourceRows.find((row) => row[0] === rowId)?.[
                    Number(columnIndex)
                ] ?? ''
            setStaged((current) => {
                if (current.has(cell)) return current
                return new Map(current).set(cell, original)
            })
        }
        setCellValues([rowId], Number(columnIndex), value)
        setEditingCell(null)
        setSelectedCell(cell)
    }

    function discardStaged() {
        setSourceRows((current) =>
            current.map((row) => {
                let next = row
                for (const [cell, original] of staged) {
                    const [rowId, columnIndex] = cell.split(':')
                    if (rowId === row[0]) {
                        next = next.map((value, index) =>
                            index === Number(columnIndex) ? original : value
                        )
                    }
                }
                return next
            })
        )
        setStaged(new Map())
    }

    function applyStaged() {
        setStaged(new Map())
        setQueryMs(7)
    }

    function resetData() {
        setSourceRows(table.rows)
        setSelectedRows([])
        setSelectedCell(firstRowId ? `${firstRowId}:1` : '')
        setEditingCell(null)
        setStaged(new Map())
        setOffsetBoth(0)
        setQueryMs(2)
    }

    function deleteRows(ids: string[]) {
        if (ids.length === 0) return
        const deleteMap = new Map(
            ids.map((id, index) => [id, index] as [string, number])
        )
        setDeletingRows(deleteMap)
        setTimeout(() => {
            setSourceRows((current) =>
                current.filter((row) => !deleteMap.has(row[0]))
            )
            setSelectedRows([])
            setQueryMs(4)
        }, 170)
        setTimeout(() => setDeletingRows(new Map()), 1100)
    }

    function toggleDryEdit() {
        if (dryEdit) setStaged(new Map())
        setDryEdit(!dryEdit)
    }

    function sortColumn(name: string) {
        if (resizeSuppressRef.current) return
        setSort((current) => {
            if (!current || current.column !== name) {
                return { column: name, dir: 'asc' }
            }
            if (current.dir === 'asc') return { column: name, dir: 'desc' }
            return null
        })
        setQueryMs(4)
    }

    function startResize(event: React.MouseEvent, name: string) {
        event.preventDefault()
        event.stopPropagation()
        const head = (event.currentTarget as HTMLElement).closest('button')
        if (!head) return
        const startWidth = head.getBoundingClientRect().width
        const startX = event.clientX
        resizeSuppressRef.current = true
        setResizingColumn(name)
        const onMove = (moveEvent: MouseEvent) => {
            setColumnWidths((widths) => ({
                ...widths,
                [name]: Math.max(
                    70,
                    Math.round(startWidth + moveEvent.clientX - startX)
                )
            }))
        }
        const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            setResizingColumn(null)
            window.setTimeout(() => {
                resizeSuppressRef.current = false
            }, 0)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }

    function clearResize(event: React.MouseEvent, name: string) {
        event.stopPropagation()
        setColumnWidths((widths) => {
            const next = { ...widths }
            delete next[name]
            return next
        })
    }

    function toggleColumn(name: string) {
        setHiddenColumns((current) => {
            if (current.includes(name)) {
                return current.filter((column) => column !== name)
            }
            if (table.columns.length - current.length <= 1) return current
            return current.concat(name)
        })
    }

    function openMenu(
        event: React.MouseEvent,
        kind: 'cell' | 'row',
        rowId: string,
        colIndex: number
    ) {
        event.preventDefault()
        const region = gridRegionRef.current
        if (!region) return
        const rect = region.getBoundingClientRect()
        const estimatedHeight = kind === 'cell' ? 176 : 196
        const x = Math.max(
            0,
            Math.min(event.clientX - rect.left, rect.width - MENU_WIDTH - 4)
        )
        const y = Math.max(
            0,
            Math.min(event.clientY - rect.top, rect.height - estimatedHeight)
        )
        if (kind === 'row' && !selectedRows.includes(rowId)) {
            setSelectedRows([rowId])
        }
        if (kind === 'cell') setSelectedCell(rowId + ':' + colIndex)
        setMenu({ kind, x, y, rowId, colIndex })
    }

    function menuEntries(state: TMenuState): TMenuEntry[] {
        const column = table.columns[state.colIndex]
        const row = sourceRows.find((entry) => entry[0] === state.rowId)
        const cellValue = row?.[state.colIndex] ?? ''
        const targetIds = selectedRows.includes(state.rowId)
            ? selectedRows
            : [state.rowId]
        const rowLabel = (base: string) =>
            targetIds.length > 1 ? `${base} (${targetIds.length} rows)` : base
        const targetRows = sourceRows.filter((entry) =>
            targetIds.includes(entry[0])
        )

        if (state.kind === 'cell') {
            return [
                {
                    label: 'Edit cell',
                    icon: Pencil,
                    disabled: column.kind === 'pk',
                    onSelect: () =>
                        startEdit(state.rowId + ':' + state.colIndex)
                },
                'separator',
                {
                    label: 'Copy value',
                    icon: Copy,
                    onSelect: () => copyText(cellValue || 'NULL')
                },
                'separator',
                {
                    label: 'Filter by this value',
                    icon: Filter,
                    onSelect: () => {
                        setConditions((current) =>
                            current.concat({
                                id:
                                    current.reduce(
                                        (max, entry) => Math.max(max, entry.id),
                                        0
                                    ) + 1,
                                column: column.name,
                                op: 'eq',
                                value: cellValue
                            })
                        )
                        setShowFilters(true)
                        setOffsetBoth(0)
                    }
                },
                'separator',
                {
                    label: rowLabel('Set to NULL'),
                    icon: Ban,
                    tone: 'destructive',
                    disabled: column.kind === 'pk',
                    onSelect: () => setCellValues(targetIds, state.colIndex, '')
                }
            ]
        }

        return [
            {
                label: rowLabel('Duplicate below'),
                icon: CopyPlus,
                onSelect: () => duplicateRows(targetIds)
            },
            'separator',
            {
                label: 'Export as JSON',
                icon: Download,
                onSelect: () =>
                    exportRows('json', table.name, table.columns, targetRows)
            },
            {
                label: 'Copy SQL INSERT',
                icon: Copy,
                onSelect: () =>
                    copyText(
                        rowsToInsert(table.name, table.columns, targetRows)
                    )
            },
            'separator',
            {
                label: rowLabel('Delete row'),
                icon: Trash2,
                tone: 'destructive',
                onSelect: () => deleteRows(targetIds)
            }
        ]
    }

    function handleGridKey(event: React.KeyboardEvent) {
        const target = event.target as HTMLElement
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
        if (view !== 'table') return
        const mod = event.metaKey || event.ctrlKey
        const [cellRowId, cellColStr] = selectedCell.split(':')
        const rowIndex = pageRows.findIndex((row) => row[0] === cellRowId)
        const colPos = visibleColumns.findIndex(
            (visible) => visible.index === Number(cellColStr)
        )

        const moveTo = (nextRow: number, nextCol: number) => {
            if (pageRows.length === 0 || visibleColumns.length === 0) return
            const row =
                pageRows[Math.max(0, Math.min(pageRows.length - 1, nextRow))]
            const col =
                visibleColumns[
                    Math.max(0, Math.min(visibleColumns.length - 1, nextCol))
                ]
            setSelectedCell(row[0] + ':' + col.index)
        }

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault()
                moveTo(mod ? 0 : rowIndex - 1, colPos)
                return
            case 'ArrowDown':
                event.preventDefault()
                moveTo(mod ? pageRows.length - 1 : rowIndex + 1, colPos)
                return
            case 'ArrowLeft':
                event.preventDefault()
                moveTo(rowIndex, mod ? 0 : colPos - 1)
                return
            case 'ArrowRight':
                event.preventDefault()
                moveTo(rowIndex, mod ? visibleColumns.length - 1 : colPos + 1)
                return
            case 'Enter':
            case 'F2':
            case 'e': {
                if (mod) return
                const column = table.columns[Number(cellColStr)]
                if (column && column.kind !== 'pk') {
                    event.preventDefault()
                    startEdit(selectedCell)
                }
                return
            }
            case ' ':
                event.preventDefault()
                toggleRow(cellRowId)
                return
            case 'a':
                if (mod) {
                    event.preventDefault()
                    setSelectedRows(pageRows.map((row) => row[0]))
                }
                return
            case 'c': {
                event.preventDefault()
                if (selectedRows.length > 0) {
                    copyText(
                        rowsToTsv(
                            table.columns,
                            sourceRows.filter((row) =>
                                selectedRows.includes(row[0])
                            )
                        )
                    )
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1400)
                    return
                }
                const row = sourceRows.find((entry) => entry[0] === cellRowId)
                copyText(row?.[Number(cellColStr)] || 'NULL')
                return
            }
            case 'd':
            case 'Delete':
                event.preventDefault()
                deleteRows(selectedRows.length > 0 ? selectedRows : [cellRowId])
                return
            case 'Escape':
                if (menu) {
                    setMenu(null)
                    return
                }
                if (selectedRows.length > 0) {
                    setSelectedRows([])
                    return
                }
                target.blur()
                return
        }
    }

    function renderHead(visible: TVisibleColumn) {
        const { column } = visible
        const active = sort?.column === column.name
        return (
            <button
                type="button"
                key={column.name}
                onClick={() => sortColumn(column.name)}
                className={
                    'group/head relative flex h-9 items-center gap-1.5 overflow-hidden border-b border-r border-sidebar-border bg-sidebar-accent/50 px-3 text-left transition-colors hover:bg-sidebar-accent ' +
                    (active ? 'bg-sidebar-accent/60' : '')
                }
            >
                <span className="text-foreground text-xs font-medium font-sans shrink-0">
                    {column.name}
                </span>
                <span className="text-muted-foreground/50 text-[10px] font-mono lowercase truncate">
                    {column.type}
                </span>
                {active && sort?.dir === 'asc' ? (
                    <ArrowUp className="ml-auto h-3 w-3 shrink-0 self-center text-primary" />
                ) : active ? (
                    <ArrowDown className="ml-auto h-3 w-3 shrink-0 self-center text-primary" />
                ) : (
                    <ArrowUpDown className="ml-auto h-3 w-3 shrink-0 self-center text-muted-foreground/50 opacity-0 transition-opacity group-hover/head:opacity-100" />
                )}
                <span
                    onMouseDown={(event) => startResize(event, column.name)}
                    onDoubleClick={(event) => clearResize(event, column.name)}
                    className={
                        'absolute right-0 top-0 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/50 ' +
                        (resizingColumn === column.name ? 'bg-primary' : '')
                    }
                />
            </button>
        )
    }

    const visibleColumnList = table.columns.filter((column) =>
        column.name.toLowerCase().includes(columnsQuery.trim().toLowerCase())
    )

    return (
        <>
            {/* Studio toolbar */}
            <div className="flex items-center h-10 pl-2 pr-2 gap-2 text-sm bg-sidebar border-b border-sidebar-border shrink-0">
                <div className="flex items-center gap-1 mr-1 pl-2">
                    <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    >
                        <PanelLeft className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-4 w-px bg-sidebar-border mx-0.5" />
                    <div className="flex items-center bg-sidebar-accent/50 rounded-md p-0.5">
                        {(
                            [
                                ['table', TableIcon],
                                ['json', FileJson],
                                ['chart', BarChart3]
                            ] as [TWorkspaceView, LucideIcon][]
                        ).map(([mode, Icon]) => (
                            <button
                                key={mode}
                                type="button"
                                aria-label={mode + ' view'}
                                onClick={() => setView(mode)}
                                className={
                                    'flex h-6 w-6 items-center justify-center rounded-sm transition-colors ' +
                                    (view === mode
                                        ? 'bg-sidebar-accent text-sidebar-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-sidebar-foreground')
                                }
                            >
                                <Icon className="h-3.5 w-3.5" />
                            </button>
                        ))}
                    </div>
                    <div className="h-4 w-px bg-sidebar-border mx-0.5" />
                    <GhostButton
                        icon={Filter}
                        label="Filters"
                        active={showFilters || filterCount > 0}
                        badge={filterCount}
                        onClick={() => setShowFilters(!showFilters)}
                    />
                    <div ref={columnsRef} className="relative">
                        <GhostButton
                            icon={Columns3}
                            label="Columns"
                            active={columnsOpen || hiddenColumns.length > 0}
                            onClick={() => setColumnsOpen(!columnsOpen)}
                        />
                        {columnsOpen && (
                            <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[200px] rounded-md border border-sidebar-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                                <div className="relative border-b border-sidebar-border pb-1">
                                    <Search className="pointer-events-none absolute left-2 top-[7px] h-3 w-3 text-muted-foreground/70" />
                                    <input
                                        value={columnsQuery}
                                        onChange={(event) =>
                                            setColumnsQuery(event.target.value)
                                        }
                                        placeholder="Search columns..."
                                        className="h-6 w-full bg-transparent pl-6 pr-2 text-[11px] text-sidebar-foreground outline-hidden placeholder:text-muted-foreground/60"
                                    />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto pt-1 hero-connection-scrollbar">
                                    {visibleColumnList.map((column) => {
                                        const shown = !hiddenColumns.includes(
                                            column.name
                                        )
                                        return (
                                            <button
                                                key={column.name}
                                                type="button"
                                                onClick={() =>
                                                    toggleColumn(column.name)
                                                }
                                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-sidebar-accent"
                                            >
                                                <span className="flex h-3.5 w-3.5 items-center justify-center">
                                                    {shown && (
                                                        <Check className="h-3 w-3 text-primary" />
                                                    )}
                                                </span>
                                                <span className="truncate">
                                                    {column.name}
                                                </span>
                                                <span className="ml-auto font-mono text-[9px] lowercase text-muted-foreground/50">
                                                    {column.type}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={toggleDryEdit}
                        className={
                            'inline-flex h-6 items-center gap-1.5 rounded-[2px] px-1.5 text-[11px] whitespace-nowrap transition-colors ' +
                            (dryEdit
                                ? 'bg-amber-500/20 text-amber-500'
                                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')
                        }
                    >
                        <Edit3 className="h-3.5 w-3.5 shrink-0 opacity-90" />
                        <span>Dry-Edit</span>
                    </button>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-1">
                    <div className="h-4 w-px bg-sidebar-border mx-0.5" />
                    <button
                        type="button"
                        onClick={addRecord}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] text-[11px] font-medium bg-primary text-primary-foreground mr-1 whitespace-nowrap transition-opacity hover:opacity-85"
                    >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span>Add record</span>
                    </button>
                    <div className="h-4 w-px bg-sidebar-border mx-0.5" />
                    <button
                        type="button"
                        onClick={resetData}
                        aria-label="Refresh"
                        className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <div ref={exportRef} className="relative">
                        <button
                            type="button"
                            aria-label="Export"
                            onClick={() => setExportOpen(!exportOpen)}
                            className={
                                'flex h-6 w-6 items-center justify-center rounded-[2px] transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground ' +
                                (exportOpen
                                    ? 'bg-sidebar-accent text-sidebar-foreground'
                                    : 'text-muted-foreground')
                            }
                        >
                            <Download className="h-3.5 w-3.5" />
                        </button>
                        {exportOpen && (
                            <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[170px] rounded-md border border-sidebar-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                                {(
                                    [
                                        ['json', 'Export JSON'],
                                        ['csv', 'Export CSV'],
                                        ['sql', 'Export SQL INSERT']
                                    ] as const
                                ).map(([format, label]) => (
                                    <button
                                        key={format}
                                        type="button"
                                        onClick={() => {
                                            exportRows(
                                                format,
                                                table.name,
                                                table.columns,
                                                displayRows
                                            )
                                            setExportOpen(false)
                                        }}
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-sidebar-accent"
                                    >
                                        <Download className="h-3 w-3 opacity-70" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showFilters && (
                <FilterBar
                    columns={table.columns}
                    conditions={conditions}
                    conjunction={conjunction}
                    onConditionsChange={(next) => {
                        setConditions(next)
                        setOffsetBoth(0)
                    }}
                    onConjunctionToggle={() =>
                        setConjunction(conjunction === 'AND' ? 'OR' : 'AND')
                    }
                    onClear={() => {
                        setConditions([])
                        setOffsetBoth(0)
                    }}
                />
            )}

            <div
                ref={gridRegionRef}
                tabIndex={0}
                onKeyDown={handleGridKey}
                className="relative flex-1 min-h-0 overflow-hidden outline-none"
            >
                {view === 'chart' ? (
                    <ChartView table={table} rows={displayRows} />
                ) : (
                    <div className="w-full text-sm font-mono">
                        {view === 'table' && (
                            <div
                                style={{ gridTemplateColumns: template }}
                                className="grid bg-sidebar"
                            >
                                <GridCheckbox
                                    active={
                                        pageRows.length > 0 &&
                                        selectedRows.length === pageRows.length
                                    }
                                    onClick={toggleAllRows}
                                />
                                {visibleColumns.map(renderHead)}
                            </div>
                        )}
                        {view === 'json' ? (
                            <pre className="m-0 h-full min-h-80 overflow-hidden bg-background px-4 py-3 text-xs leading-relaxed">
                                <JsonDocument
                                    columns={table.columns}
                                    rows={pageRows.slice(0, 6)}
                                />
                            </pre>
                        ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                                {pageRows.map((row, rowIndex) => (
                                    <TableRow
                                        key={row[0]}
                                        row={row}
                                        rowIndex={rowIndex}
                                        visibleColumns={visibleColumns}
                                        template={template}
                                        selectedRows={selectedRows}
                                        selectedCell={selectedCell}
                                        editingCell={editingCell}
                                        stagedCells={stagedCells}
                                        deletingRows={deletingRows}
                                        onRowSelect={toggleRow}
                                        onCellSelect={setSelectedCell}
                                        onEditStart={startEdit}
                                        onEditCommit={commitEdit}
                                        onEditCancel={cancelEdit}
                                        onCellMenu={(event, rowId, col) =>
                                            openMenu(event, 'cell', rowId, col)
                                        }
                                        onRowMenu={(event, rowId) =>
                                            openMenu(event, 'row', rowId, 0)
                                        }
                                    />
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                )}

                {menu && (
                    <DemoContextMenu
                        x={menu.x}
                        y={menu.y}
                        entries={menuEntries(menu)}
                        onClose={() => setMenu(null)}
                    />
                )}
                {menu && (
                    <button
                        type="button"
                        aria-label="Close menu"
                        onClick={() => setMenu(null)}
                        onContextMenu={(event) => {
                            event.preventDefault()
                            setMenu(null)
                        }}
                        className="absolute inset-0 z-40 cursor-default"
                    />
                )}

                {dialog === 'bulk-edit' && (
                    <BulkEditDialog
                        columns={table.columns}
                        count={selectedRows.length}
                        onClose={() => setDialog(null)}
                        onApply={(column, value) => {
                            const index = table.columns.findIndex(
                                (entry) => entry.name === column
                            )
                            if (index >= 0) {
                                setCellValues(selectedRows, index, value)
                            }
                        }}
                    />
                )}
                {dialog === 'set-null' && (
                    <SetNullDialog
                        columns={table.columns}
                        count={selectedRows.length}
                        onClose={() => setDialog(null)}
                        onApply={(column) => {
                            const index = table.columns.findIndex(
                                (entry) => entry.name === column
                            )
                            if (index >= 0) {
                                setCellValues(selectedRows, index, '')
                            }
                        }}
                    />
                )}
            </div>

            {staged.size > 0 && (
                <div className="flex items-center gap-2 h-9 px-3 bg-amber-500/10 border-t border-amber-500/25 shrink-0 text-xs animate-in fade-in-0 slide-in-from-bottom-1 duration-150">
                    <Edit3 className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-500">
                        Edited {staged.size} cell
                        {staged.size === 1 ? '' : 's'}
                    </span>
                    <span className="text-muted-foreground">
                        (changes not saved)
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={discardStaged}
                            className="inline-flex h-6 items-center rounded-[2px] px-2 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={applyStaged}
                            className="inline-flex h-6 items-center gap-1 rounded-[2px] bg-amber-500/20 px-2 text-[11px] font-medium text-amber-500 transition-colors hover:bg-amber-500/30"
                        >
                            <Save className="h-3 w-3" />
                            Apply Changes
                        </button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {selectedRows.length > 0 && (
                    <m.div
                        layout
                        transition={{
                            type: 'spring',
                            stiffness: 440,
                            damping: 36,
                            mass: 0.7
                        }}
                        role="toolbar"
                        className="flex items-center gap-2 h-11 px-3 bg-sidebar/80 backdrop-blur-sm border-t border-sidebar-border shrink-0 animate-in slide-in-from-bottom-2 duration-200 outline-none"
                    >
                        <div className="flex items-center gap-2 shrink-0 pr-1">
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-semibold tabular-nums px-1.5">
                                {selectedRows.length}
                            </span>
                            <span className="text-sm text-foreground/70">
                                row{selectedRows.length !== 1 ? 's' : ''}{' '}
                                selected
                            </span>
                        </div>

                        <div
                            className="h-5 w-px bg-border/60 shrink-0"
                            aria-hidden="true"
                        />

                        <div className="flex items-center gap-0.5">
                            <BarButton
                                icon={Copy}
                                label={copied ? 'Copied' : 'Copy'}
                                shortcut="C"
                                onClick={copySelected}
                            />
                            <BarButton
                                icon={CopyPlus}
                                label="Duplicate"
                                onClick={() => duplicateRows(selectedRows)}
                            />
                            <div ref={selectionExportRef} className="relative">
                                <BarButton
                                    icon={Download}
                                    label="Export"
                                    onClick={() =>
                                        setSelectionExportOpen(
                                            !selectionExportOpen
                                        )
                                    }
                                />
                                {selectionExportOpen && (
                                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 w-[120px] rounded-md border border-sidebar-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                                        {(
                                            [
                                                ['json', 'JSON'],
                                                ['csv', 'CSV']
                                            ] as const
                                        ).map(([format, label]) => (
                                            <button
                                                key={format}
                                                type="button"
                                                onClick={() => {
                                                    exportRows(
                                                        format,
                                                        table.name,
                                                        table.columns,
                                                        sourceRows.filter(
                                                            (row) =>
                                                                selectedRows.includes(
                                                                    row[0]
                                                                )
                                                        )
                                                    )
                                                    setSelectionExportOpen(
                                                        false
                                                    )
                                                }}
                                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-popover-foreground transition-colors hover:bg-sidebar-accent"
                                            >
                                                <Download className="h-3 w-3 opacity-70" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <BarButton
                                icon={Pencil}
                                label="Edit"
                                onClick={() => setDialog('bulk-edit')}
                            />
                            <BarButton
                                icon={Ban}
                                label="Set NULL"
                                onClick={() => setDialog('set-null')}
                            />
                            {staged.size > 0 && (
                                <BarButton
                                    icon={Save}
                                    label={'Save ' + staged.size}
                                    tone="emerald"
                                    onClick={applyStaged}
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                            <BarButton
                                icon={Trash2}
                                label="Delete"
                                shortcut="Del"
                                tone="destructive"
                                onClick={() => deleteRows(selectedRows)}
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedRows([])}
                                aria-label="Clear selection"
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-muted-foreground transition-[color,background-color,transform] duration-150 active:scale-[0.97] hover:bg-foreground/[0.06] hover:text-foreground"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            <div className="flex items-center justify-between h-10 px-3 bg-sidebar border-t border-sidebar-border shrink-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live · 5s
                    </span>
                    <div className="h-3 w-px bg-sidebar-border" />
                    <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {queryMs}ms
                    </span>
                    <div className="h-3 w-px bg-sidebar-border" />
                    <span>
                        {totalRows === 0
                            ? 'No rows'
                            : 'Showing ' +
                              (offset + 1) +
                              '-' +
                              Math.min(offset + limit, totalRows) +
                              ' of ' +
                              totalRows +
                              ' rows'}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Limit:</span>
                        <input
                            value={limitText}
                            title="Rows per page"
                            onChange={(event) => {
                                const text = event.target.value
                                setLimitText(text)
                                const parsed = Number(text)
                                if (/^\d+$/.test(text) && parsed > 0) {
                                    setLimit(parsed)
                                }
                            }}
                            className="flex h-6 w-16 items-center rounded-[2px] border border-input bg-transparent text-center tabular-nums text-foreground outline-hidden transition-colors focus:border-sidebar-border"
                        />
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Offset:</span>
                        <input
                            value={offsetText}
                            title="Starting row"
                            onChange={(event) => {
                                const text = event.target.value
                                setOffsetText(text)
                                const parsed = Number(text)
                                if (/^\d+$/.test(text) && parsed >= 0) {
                                    setOffset(parsed)
                                }
                            }}
                            className="flex h-6 w-16 items-center rounded-[2px] border border-input bg-transparent text-center tabular-nums text-foreground outline-hidden transition-colors focus:border-sidebar-border"
                        />
                    </span>
                    <span className="text-muted-foreground">
                        Page {pageNumber} of {pageCount}
                    </span>
                    <div className="flex items-center rounded-[2px] border border-input">
                        <button
                            type="button"
                            aria-label="Previous page"
                            disabled={offset === 0}
                            onClick={() =>
                                setOffsetBoth(Math.max(0, offset - limit))
                            }
                            className="flex h-6 w-6 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Next page"
                            disabled={offset + limit >= totalRows}
                            onClick={() => setOffsetBoth(offset + limit)}
                            className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
