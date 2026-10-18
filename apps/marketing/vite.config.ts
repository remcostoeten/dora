import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'
import mdx from 'fumadocs-mdx/vite'
import { kvDataAdapter } from '@vinext/cloudflare/cache/kv-data-adapter'
import * as mdxConfig from './source.config'

export default defineConfig({
    plugins: [
        mdx(mdxConfig),
        vinext({
            cache: {
                data: kvDataAdapter()
            }
        }),
        cloudflare({
            viteEnvironment: {
                name: 'rsc',
                childEnvironments: ['ssr']
            }
        })
    ]
})
