import { bindings, defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
    worker: defineWorker({
        name: 'dora-marketing',
        entrypoint: 'vinext/server/fetch-handler',
        compatibilityDate: '2026-10-18',
        compatibilityFlags: ['nodejs_compat'],
        assets: {
            htmlHandling: 'none',
            notFoundHandling: 'none',
            runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*']
        },
        env: {
            ASSETS: bindings.assets(),
            VINEXT_KV_CACHE: bindings.kv()
        }
    })
})
