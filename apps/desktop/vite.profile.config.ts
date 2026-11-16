import { mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(base, {
	resolve: {
		alias: [{ find: /^react-dom$/, replacement: 'react-dom/profiling' }]
	},
	build: {
		outDir: 'dist-profile',
		minify: false,
		sourcemap: false
	}
})
