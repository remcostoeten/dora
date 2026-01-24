import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react()],
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
		sourcemap: !!process.env.TAURI_DEBUG
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
})
