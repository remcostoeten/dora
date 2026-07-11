import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

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
        ]
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

export default defineConfig()
