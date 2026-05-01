import { ImageResponse } from 'next/og'

import { siteConfig } from '@/core/config/site'

export const alt = 'Dora'
export const size = {
    width: 1200,
    height: 630
}
export const contentType = 'image/png'

export default function OgImage() {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: '#f7f2e8',
                color: '#181716',
                padding: 72,
                fontFamily: 'system-ui'
            }}
        >
            <div style={{ color: '#15574f', fontSize: 34, fontWeight: 700 }}>
                {siteConfig.tagline}
            </div>
            <div style={{ fontSize: 140, fontWeight: 800, lineHeight: 0.95 }}>
                {siteConfig.name}
            </div>
        </div>,
        size
    )
}
