import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { Suspense, type ReactNode } from 'react'

import { source } from '@/modules/docs/server/source'
import { DocsSidebar, DocsSidebarFallback, Topbar } from '@/modules/navigation'
import { DocsSearchDialog } from '@/modules/search/components/search-dialog'
import { searchTags } from '@/modules/search/server/sections'
import { site } from '@/shared/config/docs-site'
import { IconMotion } from '@/shared/icons/icon-motion'

type Props = {
    children: ReactNode
}

export default function Layout({ children }: Props) {
    const tree = source.getPageTree()

    return (
        <RootProvider
            theme={{ forcedTheme: 'dark' }}
            search={{
                SearchDialog: DocsSearchDialog,
                options: { tags: searchTags() }
            }}
        >
            <div className="docs-root">
                <Topbar />
                <Suspense fallback={<DocsSidebarFallback />}>
                    <DocsSidebar tree={tree} repositoryUrl={site.repository} />
                </Suspense>
                <DocsLayout
                    tree={tree}
                    nav={{ enabled: false }}
                    searchToggle={{ enabled: false }}
                    themeSwitch={{ enabled: false }}
                    sidebar={{ enabled: false }}
                    containerProps={{ className: 'docs-layout' }}
                >
                    {children}
                </DocsLayout>
            </div>
            <IconMotion />
        </RootProvider>
    )
}
