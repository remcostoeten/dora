import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@studio/shared/utils/cn'

type GroupProps = {
	label: string
	help?: string
	action?: ReactNode
	children: ReactNode
}

export function SettingGroup({ label, help, action, children }: GroupProps) {
	return (
		<section className='[&+&]:mt-6'>
			<div className='mb-2 flex items-baseline gap-2.5 px-0.5'>
				<h2 className='text-xs font-semibold text-muted-foreground'>{label}</h2>
				{help ? <p className='text-xs text-muted-foreground/80'>{help}</p> : null}
				{action ? <div className='ml-auto'>{action}</div> : null}
			</div>
			{children}
		</section>
	)
}

export function SettingCard({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				'overflow-hidden rounded-lg border border-border bg-foreground/[0.015]',
				className
			)}
		>
			{children}
		</div>
	)
}

type RowProps = {
	focusId: string
	label: ReactNode
	help?: ReactNode
	helpTone?: 'default' | 'error' | 'ok'
	htmlFor?: string
	labelId?: string
	stacked?: boolean
	children?: ReactNode
}

const HELP_TONES: Record<NonNullable<RowProps['helpTone']>, string> = {
	default: 'text-muted-foreground',
	error: 'text-destructive-foreground',
	ok: 'text-foreground'
}

export function SettingRow({
	focusId,
	label,
	help,
	helpTone = 'default',
	htmlFor,
	labelId,
	stacked = false,
	children
}: RowProps) {
	const text = (
		<div className='min-w-0'>
			<div className='text-[13px] font-medium text-foreground'>
				{htmlFor ? (
					<label htmlFor={htmlFor}>{label}</label>
				) : (
					<span id={labelId}>{label}</span>
				)}
			</div>
			{help ? (
				<div className={cn('mt-0.5 text-xs leading-snug', HELP_TONES[helpTone])}>
					{help}
				</div>
			) : null}
		</div>
	)

	return (
		<div
			tabIndex={-1}
			data-settings-focus={focusId}
			className={cn(
				'border-t border-border px-4 py-3 outline-none transition-colors duration-150 first:border-t-0 has-[:focus-visible]:bg-focus',
				stacked ? 'grid gap-3' : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-7'
			)}
		>
			{text}
			{children ? (
				<div className={cn('flex min-w-0 items-center gap-2', !stacked && 'justify-end')}>
					{children}
				</div>
			) : null}
		</div>
	)
}

export function Kbd({ children }: { children: ReactNode }) {
	return (
		<kbd className='inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-foreground/[0.08] px-1.5 font-mono text-[10.5px] font-medium leading-none text-muted-foreground'>
			{children}
		</kbd>
	)
}

type SegmentedProps<Value extends string> = {
	value: Value
	options: { value: Value; label: string }[]
	onChange: (value: Value) => void
	label: string
}

export function SegmentedControl<Value extends string>({
	value,
	options,
	onChange,
	label
}: SegmentedProps<Value>) {
	return (
		<RadioGrid
			label={label}
			className='inline-flex gap-0.5 rounded-md border border-border bg-foreground/[0.05] p-0.5'
		>
			{options.map((option) => {
				const checked = option.value === value
				return (
					<button
						key={option.value}
						type='button'
						role='radio'
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => onChange(option.value)}
						className={cn(
							'h-6 rounded px-3 text-xs transition-colors duration-150',
							checked
								? 'bg-accent font-medium text-foreground focus-visible:bg-focus-strong'
								: 'text-muted-foreground hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong focus-visible:text-foreground'
						)}
					>
						{option.label}
					</button>
				)
			})}
		</RadioGrid>
	)
}

type RadioGridProps = {
	label: string
	className?: string
	children: ReactNode
}

function columnsOf(items: HTMLElement[]) {
	const top = items[0].offsetTop
	const count = items.findIndex((item) => item.offsetTop !== top)
	return count === -1 ? items.length : Math.max(1, count)
}

function targetIndex(key: string, index: number, count: number, columns: number) {
	switch (key) {
		case 'ArrowRight':
			return index + 1
		case 'ArrowLeft':
			return index - 1
		case 'ArrowDown':
			return columns > 1 ? index + columns : index + 1
		case 'ArrowUp':
			return columns > 1 ? index - columns : index - 1
		case 'Home':
			return 0
		case 'End':
			return count - 1
		default:
			return null
	}
}

export function RadioGrid({ label, className, children }: RadioGridProps) {
	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.altKey || event.ctrlKey || event.metaKey) return
		const items = Array.from(
			event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')
		)
		const index = items.indexOf(document.activeElement as HTMLElement)
		if (index < 0 || items.length === 0) return
		const next = targetIndex(event.key, index, items.length, columnsOf(items))
		if (next === null) return
		event.preventDefault()
		const target = items[Math.max(0, Math.min(items.length - 1, next))]
		target.focus()
		target.click()
	}

	return (
		<div role='radiogroup' aria-label={label} onKeyDown={handleKeyDown} className={className}>
			{children}
		</div>
	)
}

export function Highlight({ text, query }: { text: string; query: string }) {
	const needle = query.trim().toLowerCase()
	if (!needle) return <>{text}</>
	const start = text.toLowerCase().indexOf(needle)
	if (start < 0) return <>{text}</>
	const end = start + needle.length
	return (
		<>
			{text.slice(0, start)}
			<mark className='rounded-sm bg-foreground/[0.16] px-px text-foreground'>
				{text.slice(start, end)}
			</mark>
			{text.slice(end)}
		</>
	)
}
