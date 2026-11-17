import { createContext, useContext, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@studio/shared/utils/cn'

type SettingsFilter = {
	query: string
	rows: ReadonlySet<string> | null
}

const SettingsFilterContext = createContext<SettingsFilter>({ query: '', rows: null })

export const SettingsFilterProvider = SettingsFilterContext.Provider

export function useSettingsFilter() {
	return useContext(SettingsFilterContext)
}

export function isRowVisible(filter: SettingsFilter, focusId: string | undefined) {
	if (filter.rows === null) return true
	return focusId !== undefined && filter.rows.has(focusId)
}

export function UnfilteredOnly({ children }: { children: ReactNode }) {
	const filter = useSettingsFilter()
	return filter.rows === null ? <>{children}</> : null
}

type GroupProps = {
	label?: string
	help?: string
	action?: ReactNode
	children: ReactNode
}

export function SettingGroup({ label, help, action, children }: GroupProps) {
	return (
		<section className='settings-group [&+&]:mt-4'>
			{label || action ? (
				<div className='mb-1.5 flex items-baseline gap-2.5 px-0.5'>
					{label ? <h4 className='settings-eyebrow'>{label}</h4> : null}
					{help ? <p className='text-[11.5px] text-muted-foreground'>{help}</p> : null}
					{action ? <div className='ml-auto'>{action}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	)
}

export function SettingCard({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('settings-card', className)}>{children}</div>
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

function Searchable({ value, query }: { value: ReactNode; query: string }) {
	if (typeof value !== 'string') return <>{value}</>
	return <Highlight text={value} query={query} />
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
	const filter = useSettingsFilter()
	if (!isRowVisible(filter, focusId)) return null
	const text = <Searchable value={label} query={filter.query} />

	return (
		<div
			tabIndex={-1}
			data-settings-focus={focusId}
			className={cn(
				'settings-row',
				stacked
					? 'grid gap-2.5'
					: 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6'
			)}
		>
			<div className='min-w-0'>
				<div className='text-[12.5px] font-medium leading-snug text-foreground'>
					{htmlFor ? (
						<label htmlFor={htmlFor}>{text}</label>
					) : (
						<span id={labelId}>{text}</span>
					)}
				</div>
				{help ? (
					<div
						className={cn(
							'mt-px max-w-[64ch] text-[11.5px] leading-snug',
							HELP_TONES[helpTone]
						)}
					>
						<Searchable value={help} query={filter.query} />
					</div>
				) : null}
			</div>
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
		<kbd className='inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-secondary px-1.5 font-mono text-[10.5px] font-medium leading-none text-muted-foreground'>
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
		<RadioGrid label={label} className='settings-segmented'>
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
			<mark className='settings-mark'>{text.slice(start, end)}</mark>
			{text.slice(end)}
		</>
	)
}
