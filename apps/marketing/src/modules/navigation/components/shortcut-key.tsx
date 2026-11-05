import { cn } from '@/shared/helpers/cn'

type Props = { children: string; modifier?: string; active?: boolean }

export function ShortcutKey({ children, modifier, active = false }: Props) {
    return (
        <kbd
            className={cn(
                'pointer-events-none ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px] leading-none',
                active
                    ? 'border-foreground/40 text-foreground'
                    : 'border-foreground/15 text-foreground/70'
            )}
        >
            {modifier ? <span>{modifier} +</span> : null}
            {children}
        </kbd>
    )
}
