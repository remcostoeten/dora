'use client'

import { useState, useMemo } from 'react'
import { Search, Table2, ArrowRight, Database } from 'lucide-react'
import type { DatabaseSchema } from '@/types/database'

type Props = {
    schema: DatabaseSchema | null
    connectionId: string | null
    connected: boolean
    onTableSelect: (tableName: string, schemaName: string) => void
}

export function DataBrowserView({
    schema,
    connectionId,
    connected,
    onTableSelect,
}:      Props) {
    const [searchQuery, setSearchQuery] = useState('')

    const filteredTables = useMemo(() => {
        if (!schema) return []
        const query = searchQuery.toLowerCase()
        return schema.tables.filter(
            (t) =>
                t.name.toLowerCase().includes(query) ||
                t.schema.toLowerCase().includes(query)
        )
    }, [schema, searchQuery])

    const tablesBySchema = useMemo(() => {
        const groups: Record<string, typeof filteredTables> = {}
        for (const table of filteredTables) {
            if (!groups[table.schema]) groups[table.schema] = []
            groups[table.schema].push(table)
        }
        return groups
    }, [filteredTables])

    if (!connected || !connectionId) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Connection</h3>
                    <p className="text-sm">Connect to a database to browse tables</p>
                </div>
            </div>
        )
    }

    if (!schema || schema.tables.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <Table2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Tables Found</h3>
                    <p className="text-sm">This database has no tables to browse</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header with search */}
            <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Table list */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Object.entries(tablesBySchema).map(([schemaName, tables]) => (
                        <div key={schemaName} className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {schemaName}
                            </div>
                            {tables.map((table) => (
                                <button
                                    key={`${table.schema}.${table.name}`}
                                    onClick={() => onTableSelect(table.name, table.schema)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group text-left"
                                >
                                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                                        <Table2 className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{table.name}</div>
                                        <div className="text-xs text-muted-foreground">Click to browse</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
