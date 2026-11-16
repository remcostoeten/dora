import { createFromSource } from 'fumadocs-core/search/server'

import { source } from '@/modules/docs/server/source'
import { sectionTag } from '@/modules/search/server/sections'

export const { GET } = createFromSource(source, {
    async buildIndex(page) {
        return {
            id: page.url,
            url: page.url,
            title: page.data.title ?? page.url,
            description: page.data.description,
            structuredData: page.data.structuredData,
            tag: sectionTag(page)
        }
    }
})
