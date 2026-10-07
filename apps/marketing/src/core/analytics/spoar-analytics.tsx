'use client'

import { createAnalytics } from '@spoar/sdk'
import {
    botSignals,
    errors,
    outboundLinks,
    speedInsights
} from '@spoar/sdk/plugins'
import { useEffect } from 'react'

export function SpoarAnalytics() {
    useEffect(() => {
        const analytics = createAnalytics({
            project: 'doradb.app',
            key: 'pk_live_a1722bdf0e888978',
            endpoint: '/_ra',
            plugins: [botSignals(), errors(), outboundLinks(), speedInsights()]
        })
        return () => {
            void analytics.shutdown()
        }
    }, [])
    return null
}
