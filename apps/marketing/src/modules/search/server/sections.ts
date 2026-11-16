import 'server-only'
import { source } from '@/modules/docs/server/source'

type DocsPage = ReturnType<typeof source.getPages>[number]

export type SearchTag = {
    name: string
    value: string
}

const rootTag = 'get-started'

function folderSlugs() {
    return new Set(
        source
            .getPages()
            .filter((page) => page.slugs.length > 1)
            .map((page) => page.slugs[0])
    )
}

/**
 * @name sectionTag
 * @description The search tag of a page: its top-level folder, or the root
 * section for pages directly in `content/docs`.
 *
 * @example
 * sectionTag(page) // "guides"
 */
export function sectionTag(page: DocsPage) {
    const first = page.slugs[0]
    return first && folderSlugs().has(first) ? first : rootTag
}

/**
 * @name searchTags
 * @description One search filter per sidebar section, named like the section.
 *
 * @example
 * <RootProvider search={{ options: { tags: searchTags() } }} />
 */
export function searchTags(): SearchTag[] {
    const tree = source.getPageTree()
    const tags: SearchTag[] = [
        { name: String(tree.name ?? 'Get Started'), value: rootTag }
    ]
    for (const node of tree.children) {
        if (node.type !== 'folder') continue
        const page = source.getPages().find((candidate) => {
            const url = node.index?.url ?? ''
            return (
                candidate.url === url ||
                node.children.some(
                    (child) =>
                        child.type === 'page' && child.url === candidate.url
                )
            )
        })
        const value = page?.slugs[0]
        if (value) tags.push({ name: String(node.name), value })
    }
    return tags
}
