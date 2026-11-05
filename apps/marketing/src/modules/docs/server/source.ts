import 'server-only'
import { loader } from 'fumadocs-core/source'
import { docs } from 'collections/server'
import { iconsPlugin } from './icons-plugin'
import { sidebarMetadataPlugin } from './page-tree-plugin'

export const source = loader({
    baseUrl: '/docs',
    source: docs.toFumadocsSource(),
    pageTree: { noRef: true },
    plugins: [sidebarMetadataPlugin(), iconsPlugin()]
})
