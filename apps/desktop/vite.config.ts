import react from '@vitejs/plugin-react-swc'
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
		target: ['es2021', 'chrome105', 'safari13'],
		minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_DEBUG,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules')) {
						if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
							return 'vendor-react';
						}
						if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority') || id.includes('framer-motion')) {
							return 'vendor-ui';
						}
						if (id.includes('@monaco-editor') || id.includes('monaco-vim')) {
							return 'vendor-editor';
						}
						if (id.includes('date-fns') || id.includes('zustand') || id.includes('@tanstack/react-query')) {
							return 'vendor-utils';
						}
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
