import type { Node } from 'fumadocs-core/page-tree'
import type { ReactNode } from 'react'

export type SidebarMetadata = {
    sidebarTitle?: string
    sidebarBadge?: string
}

export type SidebarPageNode = Extract<Node, { type: 'page' }> & SidebarMetadata

export type NavigationSection = {
    id: string
    name: ReactNode
    icon?: ReactNode
    index?: SidebarPageNode
    children: Node[]
}
