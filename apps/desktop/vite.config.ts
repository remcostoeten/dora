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
		chunkSizeWarningLimit: 500
	},
	resolve: {
		dedupe: ['react', 'react-dom', 'react-router-dom'],
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@studio': path.resolve(__dirname, '../../packages/studio/src')
		}
	}
})
