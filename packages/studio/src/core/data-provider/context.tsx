import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { createTauriAdapter } from './adapters/tauri'
import type { DataAdapter, DataProviderContextValue } from './types'

function detectTauri(): boolean {
	return (
		typeof window !== 'undefined' &&
		('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

const DataProviderContext = createContext<DataProviderContextValue | null>(null)

type Props = {
	children: ReactNode
	forceMock?: boolean
}

export function DataProvider({ children, forceMock = false }: Props) {
	const [isReady, setIsReady] = useState(false)
	const [adapter, setAdapter] = useState<DataAdapter | null>(null)
	const [initError, setInitError] = useState<Error | null>(null)

	// Lazy initialization for isTauri to ensure it runs once and persists
	const [isTauri] = useState(() => !forceMock && detectTauri())

	useEffect(
		function () {
			if (isTauri) {
				setAdapter(createTauriAdapter())
				setIsReady(true)
				return
			}

			// The mock adapter (and its bundled demo dataset) is only for the web
			// demo — load it on demand so desktop startup never pays for it.
			let cancelled = false
			import('./adapters/mock')
				.then(function (m) {
					if (cancelled) return
					setAdapter(m.createMockAdapter())
					setIsReady(true)
				})
				.catch(function (error) {
					if (cancelled) return
					console.error('Failed to load the mock data adapter:', error)
					setInitError(
						error instanceof Error ? error : new Error('Failed to initialize data adapter')
					)
				})
			return function () {
				cancelled = true
			}
		},
		[isTauri]
	)

	const value: DataProviderContextValue | null = useMemo(
		() => (adapter ? { adapter, isTauri, isReady } : null),
		[adapter, isTauri, isReady]
	)

	// A rejected adapter load renders an inline message instead of hanging
	// forever on the null render below. There is no ErrorBoundary above this
	// provider, so surfacing it here (rather than throwing) avoids blanking the
	// whole window.
	if (initError) {
		return (
			<div
				role='alert'
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100vh',
					padding: '2rem',
					textAlign: 'center',
					font: '14px system-ui, sans-serif'
				}}
			>
				Failed to initialize the data adapter. Please reload the app.
			</div>
		)
	}

	if (!value || !isReady) {
		return null
	}

	return <DataProviderContext.Provider value={value}>{children}</DataProviderContext.Provider>
}

export function useDataProvider(): DataProviderContextValue {
	const context = useContext(DataProviderContext)
	if (!context) {
		throw new Error('useDataProvider must be used within a DataProvider')
	}
	return context
}

export function useAdapter(): DataAdapter {
	const { adapter } = useDataProvider()
	return adapter
}

export function useIsTauri(): boolean {
	const { isTauri } = useDataProvider()
	return isTauri
}
