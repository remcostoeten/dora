import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		globals: true
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src')
		}
	}
})
