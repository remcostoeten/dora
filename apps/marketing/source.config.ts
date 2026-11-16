import {
    type RehypeCodeOptions,
    rehypeCodeDefaultOptions
} from 'fumadocs-core/mdx-plugins'
import { pageSchema } from 'fumadocs-core/source/schema'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import lastModified from 'fumadocs-mdx/plugins/last-modified'
import * as z from 'zod'

type Transformer = NonNullable<RehypeCodeOptions['transformers']>[number]

const transformerLanguage: Transformer = {
    name: 'language',
    pre(node) {
        node.properties['data-language'] = this.options.lang
    }
}

const markdownLanguages = new Set(['md', 'markdown', 'mdx'])

function showNotationInMarkdown(transformer: Transformer): Transformer {
    return {
        ...transformer,
        code(node) {
            if (markdownLanguages.has(this.options.lang)) return
            return transformer.code?.call(this, node)
        }
    }
}

export const docs = defineDocs({
    dir: '../../docs',
    docs: {
        files: [
            'index.mdx',
            'getting-started.mdx',
            'installation.mdx',
            'api.mdx',
            'types.mdx',
            'go-cli-runner.mdx',
            'connect/*.mdx',
            'guides/*.mdx',
            'features/*.mdx'
        ],
        schema: pageSchema.extend({
            sidebarTitle: z.string().min(1).optional(),
            sidebarBadge: z.string().min(1).optional(),
            siteFooter: z.boolean().optional(),
            tocDepth: z.number().int().min(2).max(6).optional(),
            editUrl: z.union([z.string().min(1), z.literal(false)]).optional()
        }),
        postprocess: {
            includeProcessedMarkdown: true
        }
    },
    meta: {
        files: [
            'meta.json',
            'connect/meta.json',
            'guides/meta.json',
            'features/meta.json'
        ]
    }
})

export default defineConfig({
    plugins: [lastModified()],
    mdxOptions: {
        rehypeCodeOptions: {
            ...rehypeCodeDefaultOptions,
            themes: { light: 'github-light', dark: 'github-dark-default' },
            transformers: [
                ...(rehypeCodeDefaultOptions.transformers ?? []).map(
                    showNotationInMarkdown
                ),
                transformerLanguage
            ]
        }
    }
})
