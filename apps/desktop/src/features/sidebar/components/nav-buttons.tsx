import { Terminal, Database } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

type NavItem = {
	id: string
	label: string
	icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
	{ id: 'sql-console', label: 'Console', icon: Terminal },
	{ id: 'database-studio', label: 'Data Viewer', icon: Database }
]

type Props = {
	activeId?: string
	onSelect?: (id: string) => void
}

export function NavButtons({ activeId = 'database-studio', onSelect }: Props) {
	return (
		<nav className='flex flex-col gap-1'>
			{NAV_ITEMS.map((item) => (
				<button
					key={item.id}
					className={cn(
						'flex items-center rounded-md transition-all text-left border',
						activeId === item.id
							? 'bg-sidebar-accent border-sidebar-border text-sidebar-foreground'
							: 'border-transparent text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:border-sidebar-border/50'
					)}
					style={{
						paddingLeft: 'var(--spacing-md)',
						paddingRight: 'var(--spacing-md)',
						paddingTop: 'var(--spacing-xs)',
						paddingBottom: 'var(--spacing-xs)',
						height: 'var(--component-height)',
						gap: 'var(--spacing-sm)'
					}}
					onClick={() => onSelect?.(item.id)}
				>
					<item.icon className='h-4 w-4 shrink-0' />
					<span>{item.label}</span>
				</button>
			))}
		</nav>
	)
}
