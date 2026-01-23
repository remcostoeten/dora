import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./src/test/setup.ts']
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src')
		}
	}
})
