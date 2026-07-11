import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const marketingDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(marketingDir, '..', '..')

// Map of Tauri module specifiers to their web stub, by path relative to the
// studio package. The desktop globals don't exist on the web, so these resolve
// to no-op stubs in the marketing build.
const tauriStubModules = {
    '@tauri-apps/api/core': 'packages/studio/src/lib/stubs/tauri-api-core.ts',
    '@tauri-apps/api/event': 'packages/studio/src/lib/stubs/tauri-api-event.ts',
    '@tauri-apps/plugin-shell':
        'packages/studio/src/lib/stubs/tauri-plugin-shell.ts',
    '@tauri-apps/plugin-dialog':
        'packages/studio/src/lib/stubs/tauri-plugin-dialog.ts',
    '@tauri-apps/plugin-fs': 'packages/studio/src/lib/stubs/tauri-plugin-fs.ts',
    '@tauri-apps/plugin-updater':
        'packages/studio/src/lib/stubs/tauri-plugin-updater.ts',
    '@tauri-apps/plugin-process':
        'packages/studio/src/lib/stubs/tauri-plugin-process.ts'
} as const

// Turbopack's resolveAlias resolves relative paths from the project dir and
// rejects absolute paths (it treats them as server-relative), so feed it
// `./`-style paths — same as the @studio/monaco-workers alias below.
const tauriStubAliasesTurbopack = Object.fromEntries(
    Object.entries(tauriStubModules).map(([spec, rel]) => {
        const relPath = path
            .relative(marketingDir, path.join(rootDir, rel))
            .split(path.sep)
            .join('/')
        return [spec, relPath.startsWith('.') ? relPath : './' + relPath]
    })
)

// Webpack resolves aliases from absolute paths.
const tauriStubAliasesWebpack = Object.fromEntries(
    Object.entries(tauriStubModules).map(([spec, rel]) => [
        spec,
        path.join(rootDir, rel)
    ])
)

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    typedRoutes: true,
    reactCompiler: true,
    cacheComponents: true,
    experimental: {
        inlineCss: true
    },
    skipTrailingSlashRedirect: true,
    async rewrites() {
        return [
            {
                source: '/ingest/static/:path*',
                destination: 'https://us-assets.i.posthog.com/static/:path*'
            },
            {
                source: '/ingest/array/:path*',
                destination: 'https://us-assets.i.posthog.com/array/:path*'
            },
            {
                source: '/ingest/:path*',
                destination: 'https://us.i.posthog.com/:path*'
            }
        ]
    },
    transpilePackages: ['@dora/studio'],
    typescript: {
        // The @dora/studio source is consumed raw and is type-checked under its
        // own (loose) tsconfig via the desktop app. Marketing is strict, so the
        // Next build gate would spuriously fail on the vendored package internals.
        // Marketing's own code is still type-checked via `bun run typecheck`.
        ignoreBuildErrors: true
    },
    turbopack: {
        root: rootDir,
        resolveAlias: {
            // The studio package's monaco-workers module uses Vite's `?worker`
            // import syntax, which Next/turbopack can't resolve. On the web,
            // @monaco-editor/react loads workers from a CDN, so stub it out.
            '@studio/monaco-workers': './src/stubs/monaco-workers.ts',
            ...tauriStubAliasesTurbopack
        }
    },
    webpack(config) {
        config.resolve ??= {}
        config.resolve.alias = {
            ...config.resolve.alias,
            ...tauriStubAliasesWebpack
        }
        return config
    }
}

const withMDX = createMDX()

export default withMDX(nextConfig)
