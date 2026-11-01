import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'
import mdx from 'fumadocs-mdx/vite'
import { kvDataAdapter } from '@vinext/cloudflare/cache/kv-data-adapter'
import { staticAssetsAdapter } from '@vinext/cloudflare/cache/static-assets-adapter'
import * as mdxConfig from './source.config'

export default defineConfig({
    build: { sourcemap: false },
    plugins: [
        mdx(mdxConfig),
        vinext({
            prerender: true,
            cache: {
                cdn: staticAssetsAdapter(),
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
