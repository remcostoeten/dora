import { cn } from '@/shared/helpers/cn'

type Props = { active: boolean; children: string }

export function SidebarBadge({ active, children }: Props) {
    return (
        <span
            className={cn(
                'pointer-events-none border px-1.5 py-0 text-[9px] tracking-wider uppercase',
                active
                    ? 'border-solid border-foreground/25 bg-foreground/10 text-foreground'
                    : 'border-dashed border-foreground/25 text-foreground/55'
            )}
        >
            {children}
        </span>
    )
}
