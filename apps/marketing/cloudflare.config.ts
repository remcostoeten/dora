import { bindings, defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
    worker: defineWorker({
        name: 'dora-marketing',
        entrypoint: 'vinext/server/fetch-handler',
        compatibilityDate: '2026-10-18',
        compatibilityFlags: ['nodejs_compat'],
        domains: ['doradb.app', 'www.doradb.app'],
        assets: {
            htmlHandling: 'none',
            notFoundHandling: 'none',
            runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*']
        },
        env: {
            ASSETS: bindings.assets(),
            VINEXT_KV_CACHE: bindings.kv(),
            RA_SECRET: bindings.secret(),
            OAUTH_STATE_SECRET: bindings.secret(),
            SUPABASE_OAUTH_CLIENT_ID: bindings.secret(),
            SUPABASE_OAUTH_CLIENT_SECRET: bindings.secret()
        }
    })
})
