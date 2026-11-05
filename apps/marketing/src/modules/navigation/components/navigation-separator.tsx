import type { ReactNode } from 'react'

type Props = { children?: ReactNode }

export function NavigationSeparator({ children }: Props) {
    return (
        <div className="mx-4 my-2 flex items-center gap-2 lg:mx-7">
            <p className="text-[10px] tracking-wider text-foreground/45 uppercase">
                {children}
            </p>
            <div className="h-px grow bg-border" />
        </div>
    )
}
