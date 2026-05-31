import type { ReactNode } from 'react'

import { DoraHeader } from '@/components/dora-header'
import { Footer } from '@/components/footer'

type TLayoutProps = {
    children: ReactNode
}

export default function MarketingLayout({ children }: TLayoutProps) {
    return (
        <>
            <DoraHeader />
            <div className="marketing-container">{children}</div>
            <Footer />
        </>
    )
}
