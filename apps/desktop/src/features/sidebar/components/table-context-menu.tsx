import { Eye, PenLine, Shield, Scissors, Trash2, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

type TableAction = 'view-table' | 'view-info' | 'alter-table' | 'enable-rls' | 'truncate' | 'drop'

type ContextMenuItem = {
	id: TableAction
	label: string
	icon: React.ComponentType<{ className?: string }>
	variant?: 'destructive'
	shortcut?: string
}

const CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
	{ id: 'view-table', label: 'View table', icon: Eye, shortcut: 'V' },
	{ id: 'view-info', label: 'View info', icon: Info, shortcut: 'I' },
	{ id: 'alter-table', label: 'Alter table', icon: PenLine, shortcut: 'A' },
	{ id: 'enable-rls', label: 'Enable RLS', icon: Shield, shortcut: 'R' },
	{ id: 'truncate', label: 'Truncate', icon: Scissors, shortcut: 'T' },
	{ id: 'drop', label: 'Drop', icon: Trash2, variant: 'destructive' }
]

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onAction: (action: TableAction) => void
	children: React.ReactNode
}

export function TableContextMenu({ open, onOpenChange, onAction, children }: Props) {
	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-[180px]'>
				{CONTEXT_MENU_ITEMS.map((item, index) => (
					<div key={item.id}>
						{item.id === 'truncate' && <DropdownMenuSeparator />}
						<DropdownMenuItem
							onClick={() => onAction(item.id)}
							className={
								item.variant === 'destructive'
									? 'text-destructive focus:text-destructive'
									: ''
							}
						>
							<item.icon className='h-4 w-4 mr-2' />
							<span>{item.label}</span>
							{item.shortcut && (
								<span className='ml-auto text-xs tracking-widest text-muted-foreground/50'>
									{item.shortcut}
								</span>
							)}
						</DropdownMenuItem>
					</div>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export type { TableAction }
