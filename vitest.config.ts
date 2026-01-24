import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	root: __dirname,
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./__tests__/setup/vitest.setup.ts'],
		include: ['__tests__/**/*.test.{ts,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/**', 'tests/**', '**/*.config.{ts,js}', '**/types/**']
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './apps/desktop/src')
		}
	}
})
