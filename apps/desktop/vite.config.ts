import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 42069,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: ['es2021', 'chrome105', 'safari13'],
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
