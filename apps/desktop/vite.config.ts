import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
	plugins: [react(), visualizer({ open: false, filename: 'stats.html' })],
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},
	envPrefix: ['VITE_', 'TAURI_'],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'esnext',
		minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_DEBUG,
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules')) {
						if (
							id.includes('react') ||
							id.includes('react-dom') ||
							id.includes('react-router-dom')
						) {
							return 'vendor-react'
						}
						if (id.includes('@monaco-editor') || id.includes('monaco-vim')) {
							return 'vendor-monaco'
						}
						if (id.includes('@xyflow/react')) {
							return 'vendor-flow'
						}
						if (id.includes('@faker-js/faker')) {
							return 'vendor-faker'
						}
						if (id.includes('framer-motion')) {
							return 'vendor-motion'
						}
						if (id.includes('@radix-ui')) {
							return 'vendor-radix'
						}
						if (
							id.includes('date-fns') ||
							id.includes('zustand') ||
							id.includes('@tanstack/react-query')
						) {
							return 'vendor-utils'
						}
						if (id.includes('zod') || id.includes('@hookform/resolvers')) {
							return 'vendor-forms'
						}
						if (
							id.includes('lucide-react') ||
							id.includes('clsx') ||
							id.includes('tailwind-merge') ||
							id.includes('class-variance-authority')
						) {
							return 'vendor-ui-misc'
						}
					}

					// Feature-based splitting
					if (id.includes('src/features/')) {
						if (id.includes('database-studio')) return 'feature-studio'
						if (id.includes('schema-visualizer')) return 'feature-visualizer'
						if (id.includes('sql-console')) return 'feature-sql'
						if (id.includes('docker-manager')) return 'feature-docker'
						if (id.includes('app-sidebar') || id.includes('connections'))
							return 'feature-core'
					}
				}
			}
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
})
