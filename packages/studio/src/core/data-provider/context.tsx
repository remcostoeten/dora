import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { detectTauri, peekAdapter, resolveAdapter } from './resolve-adapter'
import type { DataAdapter, DataProviderContextValue } from './types'

const DataProviderContext = createContext<DataProviderContextValue | null>(null)

type Props = {
	children: ReactNode
	forceMock?: boolean
}

export function DataProvider({ children, forceMock = false }: Props) {
	// The boot path resolves the adapter before the first render, so in the app
	// this is already available and the provider never renders an empty frame.
	const [adapter, setAdapter] = useState<DataAdapter | null>(() => peekAdapter())
	const [initError, setInitError] = useState<Error | null>(null)

	// Lazy initialization for isTauri to ensure it runs once and persists
	const [isTauri] = useState(() => !forceMock && detectTauri())

	useEffect(
		function resolveAdapterOnce() {
			if (adapter) return
			let cancelled = false

			resolveAdapter(forceMock)
				.then(function (resolved) {
					if (!cancelled) setAdapter(resolved)
				})
				.catch(function (error) {
					if (cancelled) return
					console.error('Failed to load the data adapter:', error)
					setInitError(
						error instanceof Error
							? error
							: new Error('Failed to initialize data adapter')
					)
				})

			return function () {
				cancelled = true
			}
		},
		[adapter, forceMock]
	)

	const value: DataProviderContextValue | null = useMemo(
		() => (adapter ? { adapter, isTauri, isReady: true } : null),
		[adapter, isTauri]
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

	if (!value) {
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
