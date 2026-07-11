'use client'

import { useState } from 'react'
import { CornerTick } from '@/components/corner-tick'
import { connections } from '@/components/hero-app-demo-connections'
import { DemoMain } from '@/components/hero-app-demo-main'
import { DemoSidebar } from '@/components/hero-app-demo-sidebar'

const INITIAL_OPEN_CONNECTIONS = ['demo', 'prod', 'local']
const INITIAL_OPEN_TABLES = ['customers', 'orders', 'transactions']

export function AppDemo() {
    const [openTables, setOpenTables] = useState(INITIAL_OPEN_TABLES)
    const [activeTable, setActiveTable] = useState('customers')
    const [tableQuery, setTableQuery] = useState('')
    const [openConnectionIds, setOpenConnectionIds] = useState(
        INITIAL_OPEN_CONNECTIONS
    )
    const [activeConnectionId, setActiveConnectionId] = useState('demo')

    function selectTable(name: string) {
        setOpenTables(function open(names) {
            return names.includes(name) ? names : [...names, name]
        })
        setActiveTable(name)
    }

    function closeTable(name: string) {
        const next = openTables.filter((openName) => openName !== name)
        if (next.length === 0) return
        setOpenTables(next)
        if (name === activeTable) {
            const neighbour =
                next[Math.max(0, openTables.indexOf(name) - 1)] ?? next[0]
            setActiveTable(neighbour)
        }
    }

    function selectConnection(id: string) {
        setOpenConnectionIds(function open(ids) {
            return ids.includes(id) ? ids : [...ids, id]
        })
        setActiveConnectionId(id)
    }

    function closeConnection(id: string) {
        const next = openConnectionIds.filter((openId) => openId !== id)
        if (next.length === 0) return
        setOpenConnectionIds(next)
        if (id === activeConnectionId) {
            const neighbour =
                next[Math.max(0, openConnectionIds.indexOf(id) - 1)] ?? next[0]
            setActiveConnectionId(neighbour)
        }
    }

    function addConnection() {
        const next = connections.find(
            (connection) => !openConnectionIds.includes(connection.id)
        )
        if (next) selectConnection(next.id)
    }

    return (
        <div className="hero-app-demo">
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
            <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
            <div className="hero-app-demo__bottom-seal" aria-hidden="true" />
            <div className="hero-app-demo__viewport">
                <div
                    className="hero-app-demo__fade hero-app-demo__fade--sidebar"
                    aria-hidden="true"
                />
                <div className="hero-app-demo__camera">
                    <div className="hero-app-demo__window">
                        <DemoSidebar
                            activeTable={activeTable}
                            tableQuery={tableQuery}
                            activeConnectionId={activeConnectionId}
                            onTableQueryChange={setTableQuery}
                            onTableSelect={selectTable}
                            onSelectConnection={selectConnection}
                        />
                        <DemoMain
                            activeTable={activeTable}
                            openTables={openTables}
                            openConnectionIds={openConnectionIds}
                            activeConnectionId={activeConnectionId}
                            onSelectTable={setActiveTable}
                            onCloseTable={closeTable}
                            onSelectConnection={setActiveConnectionId}
                            onCloseConnection={closeConnection}
                            onAddConnection={addConnection}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
