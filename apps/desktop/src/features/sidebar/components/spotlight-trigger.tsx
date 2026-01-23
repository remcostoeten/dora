type Props = {
	onSpotlightOpen?: () => void
}

export function SpotlightTrigger({ onSpotlightOpen }: Props) {
	return (
		<button
			className='flex items-center justify-between w-full px-3 py-2 h-9 text-muted-foreground text-sm hover:text-sidebar-foreground transition-colors border-b border-sidebar-border -mx-3 -mt-3 rounded-none'
			onClick={onSpotlightOpen}
		>
			<span className='text-muted-foreground'>Spotlight...</span>
			<kbd className='pointer-events-none h-5 select-none items-center gap-1 rounded border border-sidebar-border bg-transparent px-1.5 font-mono text-[10px] font-medium text-muted-foreground inline-flex'>
				Ctrl+K
			</kbd>
		</button>
	)
}
