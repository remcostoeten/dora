import { useState, useEffect, useRef, useCallback } from 'react'
import type { DataAdapter } from '@/core/data-provider/types'
import type { TableData, SortDescriptor, FilterDescriptor } from '../types'

export type ChangeType = 'insert' | 'update' | 'delete'

export type ChangeEvent = {
    id: string
    timestamp: number
    changeType: ChangeType
    tableName: string
    summary: string
    rowCount: number
    details?: Record<string, unknown>[]
}

export type LiveMonitorSubscription = {
    tableNames: string[]
    changeTypes: ChangeType[]
}

export type LiveMonitorConfig = {
    enabled: boolean
    intervalMs: number
    subscription: LiveMonitorSubscription
}

export const DEFAULT_LIVE_MONITOR_CONFIG: LiveMonitorConfig = {
    enabled: false,
    intervalMs: 5000,
    subscription: {
        tableNames: [],
        changeTypes: ['insert', 'update', 'delete']
    }
}

type LiveMonitorState = {
    config: LiveMonitorConfig
    setConfig: (config: LiveMonitorConfig | ((prev: LiveMonitorConfig) => LiveMonitorConfig)) => void
    isPolling: boolean
    changeEvents: ChangeEvent[]
    clearEvents: () => void
    lastPolledAt: number | null
    unreadCount: number
    markRead: () => void
}

type LiveMonitorParams = {
    adapter: DataAdapter
    connectionId: string | undefined
    tableName: string | null
    tableData: TableData | null
    sort: SortDescriptor | undefined
    filters: FilterDescriptor[]
    paginationLimit: number
    paginationOffset: number
    isPaused: boolean
    onDataChanged: () => void
}

function generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function findPrimaryKeyColumn(tableData: TableData): string | null {
    const pkCol = tableData.columns.find(function (col) {
        return col.primaryKey
    })
    return pkCol ? pkCol.name : null
}

function hasTableDataChanged(previous: TableData, current: TableData): boolean {
    if (previous.totalCount !== current.totalCount) return true
    if (previous.columns.length !== current.columns.length) return true
    if (previous.rows.length !== current.rows.length) return true

    for (let index = 0; index < previous.columns.length; index++) {
        if (previous.columns[index].name !== current.columns[index].name) {
            return true
        }
    }

    for (let rowIndex = 0; rowIndex < previous.rows.length; rowIndex++) {
        const previousRow = previous.rows[rowIndex]
        const currentRow = current.rows[rowIndex]
        const previousKeys = Object.keys(previousRow)

        if (previousKeys.length !== Object.keys(currentRow).length) {
            return true
        }

        for (const key of previousKeys) {
            if (String(previousRow[key]) !== String(currentRow[key])) {
                return true
            }
        }
    }

    return false
}

function diffTableData(
    previous: TableData,
    current: TableData,
    tableName: string,
    subscribedTypes: ChangeType[]
): ChangeEvent[] {
    const events: ChangeEvent[] = []
    const pkColumn = findPrimaryKeyColumn(previous)

    if (!pkColumn) {
        if (previous.totalCount !== current.totalCount) {
            const diff = current.totalCount - previous.totalCount
            if (diff > 0 && subscribedTypes.includes('insert')) {
                events.push({
                    id: generateEventId(),
                    timestamp: Date.now(),
                    changeType: 'insert',
                    tableName,
                    summary: `${diff} row${diff !== 1 ? 's' : ''} added`,
                    rowCount: diff
                })
            } else if (diff < 0 && subscribedTypes.includes('delete')) {
                const absDiff = Math.abs(diff)
                events.push({
                    id: generateEventId(),
                    timestamp: Date.now(),
                    changeType: 'delete',
                    tableName,
                    summary: `${absDiff} row${absDiff !== 1 ? 's' : ''} removed`,
                    rowCount: absDiff
                })
            }
        } else if (
            subscribedTypes.includes('update') &&
            hasTableDataChanged(previous, current)
        ) {
            events.push({
                id: generateEventId(),
                timestamp: Date.now(),
                changeType: 'update',
                tableName,
                summary: 'Visible rows changed',
                rowCount: current.rows.length
            })
        }
        return events
    }

    const previousRowMap = new Map<string, Record<string, unknown>>()
    for (const row of previous.rows) {
        const key = String(row[pkColumn])
        previousRowMap.set(key, row)
    }

    const currentRowMap = new Map<string, Record<string, unknown>>()
    for (const row of current.rows) {
        const key = String(row[pkColumn])
        currentRowMap.set(key, row)
    }

    if (subscribedTypes.includes('insert')) {
        const insertedRows: Record<string, unknown>[] = []
        for (const [key, row] of currentRowMap) {
            if (!previousRowMap.has(key)) {
                insertedRows.push(row)
            }
        }
        if (insertedRows.length > 0) {
            events.push({
                id: generateEventId(),
                timestamp: Date.now(),
                changeType: 'insert',
                tableName,
                summary: `${insertedRows.length} row${insertedRows.length !== 1 ? 's' : ''} inserted`,
                rowCount: insertedRows.length,
                details: insertedRows.slice(0, 5)
            })
        }
    }

    if (subscribedTypes.includes('delete')) {
        const deletedRows: Record<string, unknown>[] = []
        for (const [key, row] of previousRowMap) {
            if (!currentRowMap.has(key)) {
                deletedRows.push(row)
            }
        }
        if (deletedRows.length > 0) {
            events.push({
                id: generateEventId(),
                timestamp: Date.now(),
                changeType: 'delete',
                tableName,
                summary: `${deletedRows.length} row${deletedRows.length !== 1 ? 's' : ''} deleted`,
                rowCount: deletedRows.length,
                details: deletedRows.slice(0, 5)
            })
        }
    }

    if (subscribedTypes.includes('update')) {
        const updatedColumns = new Set<string>()
        let updatedRowCount = 0

        for (const [key, currentRow] of currentRowMap) {
            const previousRow = previousRowMap.get(key)
            if (!previousRow) continue

            let rowChanged = false
            for (const col of previous.columns) {
                if (col.name === pkColumn) continue
                if (String(previousRow[col.name]) !== String(currentRow[col.name])) {
                    updatedColumns.add(col.name)
                    rowChanged = true
                }
            }
            if (rowChanged) {
                updatedRowCount++
            }
        }

        if (updatedRowCount > 0) {
            const columnList = Array.from(updatedColumns).slice(0, 3).join(', ')
            const extra = updatedColumns.size > 3 ? ` +${updatedColumns.size - 3} more` : ''
            events.push({
                id: generateEventId(),
                timestamp: Date.now(),
                changeType: 'update',
                tableName,
                summary: `${updatedRowCount} row${updatedRowCount !== 1 ? 's' : ''} updated in ${columnList}${extra}`,
                rowCount: updatedRowCount
            })
        }
    }

    return events
}

const MAX_EVENTS = 50

export function useLiveMonitor({
    adapter,
    connectionId,
    tableName,
    tableData,
    sort,
    filters,
    paginationLimit,
    paginationOffset,
    isPaused,
    onDataChanged
}: LiveMonitorParams): LiveMonitorState {
    const [config, setConfig] = useState<LiveMonitorConfig>(DEFAULT_LIVE_MONITOR_CONFIG)
    const [isPolling, setIsPolling] = useState(false)
    const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([])
    const [lastPolledAt, setLastPolledAt] = useState<number | null>(null)
    const [unreadCount, setUnreadCount] = useState(0)

    const snapshotRef = useRef<TableData | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const onDataChangedRef = useRef(onDataChanged)
    onDataChangedRef.current = onDataChanged

    useEffect(function syncSnapshot() {
        if (tableData) {
            snapshotRef.current = tableData
        }
    }, [tableData])

    const poll = useCallback(
        async function pollForChanges() {
            if (!connectionId || !tableName || !snapshotRef.current) return

            setIsPolling(true)
            try {
                const result = await adapter.fetchTableData(
                    connectionId,
                    tableName,
                    Math.floor(paginationOffset / paginationLimit),
                    paginationLimit,
                    sort,
                    filters
                )

                if (result.ok) {
                    const newData = result.data
                    const dataChanged = hasTableDataChanged(snapshotRef.current, newData)
                    const events = diffTableData(
                        snapshotRef.current,
                        newData,
                        tableName,
                        config.subscription.changeTypes
                    )

                    if (events.length > 0) {
                        setChangeEvents(function (prev) {
                            const combined = [...events, ...prev]
                            return combined.slice(0, MAX_EVENTS)
                        })
                        setUnreadCount(function (prev) {
                            return prev + events.length
                        })
                    }

                    if (dataChanged) {
                        snapshotRef.current = newData
                        onDataChangedRef.current()
                    }

                    setLastPolledAt(Date.now())
                }
            } catch (_error) {
                // silently ignore polling errors
            } finally {
                setIsPolling(false)
            }
        },
        [adapter, connectionId, tableName, paginationLimit, paginationOffset, sort, filters, config.subscription.changeTypes]
    )

    useEffect(
        function managePollInterval() {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }

            const shouldPoll = config.enabled && !isPaused && connectionId && tableName

            if (!shouldPoll) return

            intervalRef.current = setInterval(poll, config.intervalMs)

            return function cleanup() {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            }
        },
        [config.enabled, config.intervalMs, isPaused, connectionId, tableName, poll]
    )

    useEffect(function cleanupOnUnmount() {
        return function () {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [])

    const clearEvents = useCallback(function () {
        setChangeEvents([])
        setUnreadCount(0)
    }, [])

    const markRead = useCallback(function () {
        setUnreadCount(0)
    }, [])

    return {
        config,
        setConfig,
        isPolling,
        changeEvents,
        clearEvents,
        lastPolledAt,
        unreadCount,
        markRead
    }
}
