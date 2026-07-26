import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import type { SidebarContextValue, SidebarVariant } from './types'

const SidebarContext = createContext<SidebarContextValue | null>(null)

type Props = {
	children: ReactNode
	defaultVariant?: SidebarVariant
	defaultActiveItemId?: string | null
}

export function SidebarProvider({
	children,
	defaultVariant = 'default',
	defaultActiveItemId = null
}: Props) {
	const [variant, setVariant] = useState<SidebarVariant>(defaultVariant)
	const [activeItemId, setActiveItemId] = useState<string | null>(defaultActiveItemId)

	const value = useMemo(
		() => ({
			variant,
			activeItemId,
			setVariant,
			setActiveItemId
		}),
		[variant, activeItemId]
	)

	return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
	const context = useContext(SidebarContext)
	if (!context) {
		throw new Error('useSidebar must be used within a SidebarProvider')
	}
	return context
}
