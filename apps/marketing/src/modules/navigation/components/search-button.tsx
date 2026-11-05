'use client'

import { SearchIcon } from '@/shared/icons/icons'

type Props = { onClick: () => void }

export function SearchButton({ onClick }: Props) {
    return (
        <button
            type="button"
            className="group/search flex w-full items-center gap-2 border-b border-foreground/5 px-4 py-[9px] text-sm text-foreground/55 transition-colors duration-150 ease-hover hover:bg-foreground/3 hover:text-foreground/80 focus-visible:bg-foreground/6 focus-visible:text-foreground"
            onClick={onClick}
        >
            <SearchIcon className="size-4 shrink-0 text-foreground/40 transition-colors duration-150 ease-hover group-hover/search:text-foreground/70 group-focus-visible/search:text-foreground" />
            <span className="truncate">Search</span>
            <kbd className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border border-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground/40 transition-colors duration-150 ease-hover group-hover/search:border-foreground/20 group-hover/search:text-foreground/60 group-focus-visible/search:border-foreground/25">
                <span className="text-[11px]">&#8984;</span>K
            </kbd>
        </button>
    )
}
