import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";
import type { SidebarContextValue, SidebarVariant } from "./types";

const SidebarContext = createContext<SidebarContextValue | null>(null)

type SidebarProviderProps = {
	children: ReactNode
	defaultVariant?: SidebarVariant
	defaultActiveItemId?: string | null
	defaultPanelOpen?: boolean
}

export function SidebarProvider({
	children,
	defaultVariant = 'default',
	defaultActiveItemId = null,
	defaultPanelOpen = true
}: SidebarProviderProps) {
	const [variant, setVariant] = useState<SidebarVariant>(defaultVariant)
	const [activeItemId, setActiveItemId] = useState<string | null>(defaultActiveItemId)
	const [isPanelOpen, setPanelOpen] = useState(defaultPanelOpen)

	const togglePanel = useCallback(() => {
		setPanelOpen((prev) => !prev)
	}, [])

	const value = useMemo(
		() => ({
			variant,
			activeItemId,
			isPanelOpen,
			setVariant,
			setActiveItemId,
			setPanelOpen,
			togglePanel
		}),
		[variant, activeItemId, isPanelOpen, togglePanel]
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
