'use client'

import { useState } from 'react'
import { CornerTick } from '@/components/corner-tick'
import { DemoMain } from '@/components/hero-app-demo-main'
import { DemoSidebar } from '@/components/hero-app-demo-sidebar'

export function AppDemo() {
    const [activeTable, setActiveTable] = useState('customers')
    const [tableQuery, setTableQuery] = useState('')

    return (
        <div className="hero-app-demo">
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
            <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
            <div className="hero-app-demo__viewport">
                <div className="hero-app-demo__camera">
                    <div className="hero-app-demo__window">
                        <DemoSidebar
                            activeTable={activeTable}
                            tableQuery={tableQuery}
                            onTableQueryChange={setTableQuery}
                            onTableSelect={setActiveTable}
                        />
                        <DemoMain activeTable={activeTable} />
                    </div>
                </div>
            </div>
        </div>
    )
}
