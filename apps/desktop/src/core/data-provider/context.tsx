import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createMockAdapter } from './adapters/mock'
import { createTauriAdapter } from './adapters/tauri'
import type { DataAdapter, DataProviderContextValue } from './types'

function detectTauri(): boolean {
	const isTauri =
		typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	console.log(
		'[DataProvider] detectTauri:',
		isTauri,
		'window keys:',
		typeof window !== 'undefined'
			? Object.keys(window).filter((k) => k.includes('TAURI'))
			: 'N/A'
	)
	return isTauri
}

const DataProviderContext = createContext<DataProviderContextValue | null>(null)

type Props = {
	children: ReactNode
	forceMock?: boolean
}

export function DataProvider({ children, forceMock = false }: Props) {
	const [isReady, setIsReady] = useState(false)
	const [adapter, setAdapter] = useState<DataAdapter | null>(null)

	// Lazy initialization for isTauri to ensure it runs once and persists
	const [isTauri] = useState(() => !forceMock && detectTauri())

	useEffect(
		function () {
			if (isTauri) {
				setAdapter(createTauriAdapter())
			} else {
				setAdapter(createMockAdapter())
			}
			setIsReady(true)
		},
		[isTauri]
	)

	if (!isReady || !adapter) {
		return null
	}

	const value: DataProviderContextValue = {
		adapter,
		isTauri,
		isReady
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
