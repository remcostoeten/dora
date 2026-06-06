/// <reference types="vite/client" />

declare module '*.worker?worker' {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}
