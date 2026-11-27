import type { ReactNode } from 'react'

import { SiteDocument } from '@/components/site-document'

export {
    rootMetadata as metadata,
    rootViewport as viewport
} from '@/core/config/root-metadata'

type Props = {
    children: ReactNode
}

export default function RootLayout({ children }: Props) {
    return <SiteDocument>{children}</SiteDocument>
}
