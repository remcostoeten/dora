/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

interface Window {
	__DORA_CAPTURE_MODE?: boolean
	__DORA_CAPTURE_READY_AT?: number
	__DORA_CAPTURE_T0?: number
	__DORA_CAPTURE_SET_SQL?: (sql: string) => void
	__DORA_CAPTURE_RUN_SQL?: (sql: string) => void
	__DORA_CAPTURE_SET_DRIZZLE?: (code: string) => void
	__DORA_CAPTURE_RUN_DRIZZLE?: (code: string) => void
}

declare module '*.worker?worker' {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}
