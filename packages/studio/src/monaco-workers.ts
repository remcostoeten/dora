import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Without this, @monaco-editor/react loads Monaco core from the jsdelivr CDN at
// runtime. The packaged Tauri CSP (default-src 'self') blocks that fetch, so the
// editor hangs on its loading state forever in release builds. Pinning the loader
// to the locally bundled Monaco keeps everything self-hosted.
loader.config({ monaco })

self.MonacoEnvironment = {
	getWorker(_: unknown, label: string) {
		if (label === 'json') {
			return new jsonWorker()
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return new cssWorker()
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return new htmlWorker()
		}
		if (label === 'typescript' || label === 'javascript') {
			return new tsWorker()
		}
		return new editorWorker()
	}
}

let workersPreloaded = false

export function preloadMonacoWorkers(): void {
	if (workersPreloaded) return
	workersPreloaded = true
	const workers = [new editorWorker(), new tsWorker()]
	window.setTimeout(() => {
		workers.forEach((worker) => worker.terminate())
	}, 1000)
}
