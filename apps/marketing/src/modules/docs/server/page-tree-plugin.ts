import 'server-only'
import type { LoaderPlugin } from 'fumadocs-core/source'
import * as z from 'zod'
import type { SidebarMetadata } from '@/modules/navigation/types/navigation'

const sidebarMetadataSchema = z.object({
    sidebarTitle: z.string().optional().catch(undefined),
    sidebarBadge: z.string().optional().catch(undefined)
}) satisfies z.ZodType<SidebarMetadata>

/**
 * @name sidebarMetadataPlugin
 * @description Copies the `sidebarTitle` and `sidebarBadge` frontmatter of each
 * page onto its page tree node so the sidebar can render them.
 *
 * @example
 * loader({ source, plugins: [sidebarMetadataPlugin()] })
 */
export function sidebarMetadataPlugin(): LoaderPlugin {
    return {
        name: 'sidebar-metadata',
        transformPageTree: {
            file(node, file) {
                const sourceFile = file ? this.storage.read(file) : undefined
                const metadata = sidebarMetadataSchema.safeParse(
                    sourceFile?.data
                )
                if (metadata.success) Object.assign(node, metadata.data)
                return node
            }
        }
    }
}
