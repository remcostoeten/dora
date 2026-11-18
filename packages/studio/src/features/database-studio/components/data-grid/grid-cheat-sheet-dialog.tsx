import { useMemo, useState } from 'react'
import type { ShortcutDefinition, ShortcutName } from '@studio/core/shortcuts'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@studio/shared/ui/dialog'
import { Input } from '@studio/shared/ui/input'
import { buildCheatSheet, filterCheatSheet } from './grid-cheat-sheet'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onReturnFocus: () => void
	shortcuts: Record<ShortcutName, ShortcutDefinition>
}

export function GridCheatSheetDialog({ open, onOpenChange, onReturnFocus, shortcuts }: Props) {
	const [query, setQuery] = useState('')
	const sheet = useMemo(() => buildCheatSheet(shortcuts), [shortcuts])
	const visible = filterCheatSheet(sheet, query)

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setQuery('')
				onOpenChange(next)
			}}
		>
			<DialogContent
				className='sm:max-w-[720px]'
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					onReturnFocus()
				}}
			>
				<DialogHeader>
					<DialogTitle>Grid keyboard shortcuts</DialogTitle>
					<DialogDescription>
						Every command the grid runs, with your current shortcuts. Change them in
						Settings under Shortcuts.
					</DialogDescription>
				</DialogHeader>
				<Input
					autoFocus
					value={query}
					placeholder='Filter shortcuts'
					aria-label='Filter shortcuts'
					data-no-shortcuts='true'
					onChange={(event) => setQuery(event.target.value)}
				/>
				<div
					tabIndex={0}
					aria-label='Shortcut list'
					className='max-h-[55vh] overflow-auto rounded-md focus-visible:bg-focus sm:columns-2 sm:gap-6'
				>
					{visible.length === 0 && (
						<p className='text-sm text-muted-foreground'>No shortcut matches.</p>
					)}
					{visible.map((section) => (
						<section key={section.title} className='mb-4 break-inside-avoid'>
							<h3 className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
								{section.title}
							</h3>
							<dl>
								{section.entries.map((entry) => (
									<div
										key={entry.id}
										className='flex items-baseline justify-between gap-3 py-0.5 text-sm'
									>
										<dt>{entry.description}</dt>
										<dd className='flex shrink-0 flex-wrap justify-end gap-1'>
											{entry.combos.map((combo) => (
												<kbd
													key={combo}
													className='rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[11px]'
												>
													{combo}
												</kbd>
											))}
										</dd>
									</div>
								))}
							</dl>
						</section>
					))}
				</div>
			</DialogContent>
		</Dialog>
	)
}
