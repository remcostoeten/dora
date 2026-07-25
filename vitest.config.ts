import fs from 'fs'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vitest/config'

// The studio UI libraries (radix, react-remove-scroll, …) resolve React from
// packages/studio/node_modules, where every dependency shares one pnpm
// `.pnpm/react@18.3.1` copy. The root test harness has its own React install,
// so React/ReactDOM/testing-library imports would otherwise load a *second*
// instance and trigger "Invalid hook call". Pinning the harness-level packages
// to studio's copies makes the whole graph share one React instance.
function studioDep(rel: string): string {
	const target = path.resolve(__dirname, 'packages/studio/node_modules', rel)
	try {
		return fs.realpathSync(target)
	} catch {
		return target
	}
}

const STUDIO_REACT = studioDep('react')
const STUDIO_REACT_DOM = studioDep('react-dom')

export default defineConfig({
	plugins: [react()],
	root: __dirname,
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./__tests__/vitest.setup.ts'],
		include: [
			'__tests__/**/*.test.{ts,tsx}',
			'packages/*/src/**/*.test.{ts,tsx}',
			'apps/*/src/**/*.test.{ts,tsx}'
		],
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			reportsDirectory: './.cache/coverage',
			exclude: ['node_modules/**', 'tests/**', '**/*.config.{ts,js}', '**/types/**']
		}
	},
	resolve: {
		dedupe: ['react', 'react-dom'],
		alias: [
			{ find: /^react$/, replacement: STUDIO_REACT },
			{ find: /^react\//, replacement: STUDIO_REACT + '/' },
			{ find: /^react-dom$/, replacement: STUDIO_REACT_DOM },
			{ find: /^react-dom\//, replacement: STUDIO_REACT_DOM + '/' },
			{ find: '@testing-library/react', replacement: studioDep('@testing-library/react') },
			{
				find: '@testing-library/user-event',
				replacement: studioDep('@testing-library/user-event')
			},
			{ find: '@testing-library/jest-dom', replacement: studioDep('@testing-library/jest-dom') },
			// React-context libraries the tests import directly from the root
			// install — pin to studio so they share its React instance too.
			{ find: '@tanstack/react-query', replacement: studioDep('@tanstack/react-query') },
			{ find: 'react-router-dom', replacement: studioDep('react-router-dom') },
			{ find: '@studio', replacement: path.resolve(__dirname, './packages/studio/src') },
			{ find: '@', replacement: path.resolve(__dirname, './packages/studio/src') }
		]
	}
})
