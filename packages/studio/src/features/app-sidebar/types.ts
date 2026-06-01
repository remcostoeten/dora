import type { LucideIcon } from 'lucide-react'

export type SidebarVariant = 'default' | 'floating'

export type NavItem = {
	id: string
	label: string
	icon: LucideIcon
	onClick?: () => void
	disabled?: boolean
	badge?: string | number
}

export type SidebarState = {
	variant: SidebarVariant
	activeItemId: string | null
}

export type SidebarContextValue = {
	setVariant: (variant: SidebarVariant) => void
	setActiveItemId: (id: string | null) => void
} & SidebarState
