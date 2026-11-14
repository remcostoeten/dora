import { memo, useCallback, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Info } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import { effectiveName } from './store'
import { useDialog, useDialogStore, useFocusRequest } from './store-context'
import type { FormKey, FormState } from './model'
import { suggestName } from './connection-mapping'

type StringKey = { [Key in FormKey]: FormState[Key] extends string ? Key : never }[FormKey]
type BooleanKey = { [Key in FormKey]: FormState[Key] extends boolean ? Key : never }[FormKey]

export const FIELD_CLASS =
	'h-9 w-full min-w-0 border border-border/70 bg-foreground/[0.03] px-2.5 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground/70 hover:bg-foreground/[0.055] focus:bg-focus aria-[invalid=true]:border-red-500/55 aria-[invalid=true]:bg-red-500/[0.07]'

export const MICRO_CLASS = 'text-xs uppercase tracking-[0.18em] text-muted-foreground'

export function fieldId(name: string): string {
	return `cd-${name}`
}

type TextProps = {
	name: StringKey
	label: string
	optional?: boolean
	help?: ReactNode
	mono?: boolean
	secret?: boolean
	multiline?: boolean
	placeholder?: string
	inputMode?: 'numeric'
	suffix?: ReactNode
	className?: string
}

export const TextField = memo(function TextField({
	name,
	label,
	optional,
	help,
	mono,
	secret,
	multiline,
	placeholder,
	inputMode,
	suffix,
	className
}: TextProps) {
	const store = useDialogStore()
	const value = useDialog((state) => state.form[name])
	const error = useDialog((state) => state.errors[name])
	const [revealed, setRevealed] = useState(false)
	const elementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
	const setElement = useCallback((element: HTMLInputElement | HTMLTextAreaElement | null) => {
		elementRef.current = element
	}, [])
	useFocusRequest(name, elementRef)

	const id = fieldId(name)
	const common = {
		id,
		value,
		placeholder,
		autoComplete: 'off',
		spellCheck: false,
		'aria-invalid': error ? true : undefined,
		'aria-describedby': `${id}-msg`,
		className: cn(FIELD_CLASS, mono && 'font-mono text-[13px]'),
		onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			store.getState().setField(name, event.target.value)
	}

	return (
		<div className={cn('min-w-0', className)}>
			<label
				htmlFor={id}
				className='mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80'
			>
				{label}
				{optional ? (
					<span className='font-normal text-muted-foreground'>Optional</span>
				) : null}
			</label>
			<div className='flex'>
				{multiline ? (
					<textarea
						{...common}
						ref={setElement}
						rows={3}
						className={cn(
							common.className,
							'h-auto min-h-[78px] resize-y py-2 leading-relaxed break-all'
						)}
					/>
				) : (
					<input
						{...common}
						ref={setElement}
						type={secret && !revealed ? 'password' : 'text'}
						inputMode={inputMode}
					/>
				)}
				{secret ? (
					<button
						type='button'
						aria-label={`${revealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
						onClick={() => setRevealed((shown) => !shown)}
						className='grid w-9 flex-none place-items-center border border-l-0 border-border/70 bg-foreground/[0.03] text-muted-foreground transition-colors duration-150 hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong'
					>
						{revealed ? (
							<EyeOff className='h-[15px] w-[15px]' />
						) : (
							<Eye className='h-[15px] w-[15px]' />
						)}
					</button>
				) : null}
				{suffix}
			</div>
			<FieldMessage id={`${id}-msg`} error={error} help={help} />
		</div>
	)
})

type MessageProps = {
	id: string
	error: string | undefined
	help: ReactNode
}

function FieldMessage({ id, error, help }: MessageProps) {
	if (error) {
		return (
			<p
				id={id}
				className='mt-1.5 flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400'
			>
				<AlertCircle className='h-3 w-3 flex-none' />
				{error}
			</p>
		)
	}
	return (
		<p id={id} className={cn('mt-1.5 text-xs text-muted-foreground', !help && 'hidden')}>
			{help}
		</p>
	)
}

type NameProps = {
	help: string
}

export const NameField = memo(function NameField({ help }: NameProps) {
	const store = useDialogStore()
	const value = useDialog(effectiveName)
	const placeholder = useDialog((state) =>
		state.source ? suggestName(state.source, state.form, state.via) : ''
	)
	const error = useDialog((state) => state.errors.name)
	const ref = useRef<HTMLInputElement>(null)
	useFocusRequest('name', ref)

	return (
		<div>
			<label
				htmlFor={fieldId('name')}
				className='mb-1.5 block text-xs font-medium text-foreground/80'
			>
				Connection name
			</label>
			<input
				ref={ref}
				id={fieldId('name')}
				value={value}
				placeholder={placeholder || 'e.g. shop-prod'}
				autoComplete='off'
				spellCheck={false}
				aria-invalid={error ? true : undefined}
				aria-describedby={`${fieldId('name')}-msg`}
				onChange={(event) => store.getState().setName(event.target.value)}
				className={FIELD_CLASS}
			/>
			<FieldMessage id={`${fieldId('name')}-msg`} error={error} help={help} />
		</div>
	)
})

type CheckProps = {
	name: BooleanKey
	title: string
	hint?: string
}

export const CheckRow = memo(function CheckRow({ name, title, hint }: CheckProps) {
	const store = useDialogStore()
	const checked = useDialog((state) => state.form[name])

	return (
		<label className='-mx-2.5 flex cursor-pointer items-start gap-2.5 px-2.5 py-2 transition-colors duration-150 hover:bg-focus has-[:focus-visible]:bg-focus-strong'>
			<input
				type='checkbox'
				checked={checked}
				onChange={(event) => store.getState().setField(name, event.target.checked)}
				className='peer sr-only'
			/>
			<span className='mt-0.5 grid h-4 w-4 flex-none place-items-center border border-foreground/35 text-transparent transition-colors duration-150 peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background'>
				<Check className='h-3 w-3' />
			</span>
			<span className='text-[13px]'>
				{title}
				{hint ? (
					<small className='block text-xs text-muted-foreground'>{hint}</small>
				) : null}
			</span>
		</label>
	)
})

type SwitchProps = {
	name: BooleanKey
	title: string
	why?: string
}

export const SwitchRow = memo(function SwitchRow({ name, title, why }: SwitchProps) {
	const store = useDialogStore()
	const checked = useDialog((state) => state.form[name])

	return (
		<label className='flex h-9 cursor-pointer items-center gap-2.5 border border-border/70 bg-foreground/[0.03] px-2.5 transition-colors duration-150 hover:bg-foreground/[0.055] has-[:focus-visible]:bg-focus-strong'>
			<input
				type='checkbox'
				checked={checked}
				onChange={(event) => store.getState().setField(name, event.target.checked)}
				className='peer sr-only'
			/>
			<span className='relative h-4 w-7 flex-none bg-foreground/[0.18] transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:bg-card after:transition-transform after:duration-150 peer-checked:bg-emerald-500 peer-checked:after:translate-x-3' />
			<span className='flex-1 text-[13px]'>{title}</span>
			{why ? (
				<span className='min-w-0 truncate text-[11px] text-muted-foreground'>{why}</span>
			) : null}
		</label>
	)
})

type SegmentedProps<Value extends string> = {
	label: string
	value: Value
	items: readonly { value: Value; label: string }[]
	onChange: (value: Value) => void
}

export function Segmented<Value extends string>({
	label,
	value,
	items,
	onChange
}: SegmentedProps<Value>) {
	return (
		<div role='tablist' aria-label={label} className='inline-flex border border-border/70'>
			{items.map((item, index) => (
				<button
					key={item.value}
					type='button'
					role='tab'
					aria-selected={item.value === value}
					onClick={() => onChange(item.value)}
					className={cn(
						'h-7 px-3 text-xs text-muted-foreground transition-colors duration-150 hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong aria-selected:bg-foreground/[0.11] aria-selected:font-medium aria-selected:text-foreground',
						index > 0 && 'border-l border-border/70'
					)}
				>
					{item.label}
				</button>
			))}
		</div>
	)
}

type NoteProps = {
	tone: 'info' | 'error' | 'ok'
	children: ReactNode
	className?: string
}

const NOTE_TONE = {
	info: 'border-blue-500/30 bg-blue-500/[0.07] [&>svg]:text-blue-500 dark:[&>svg]:text-blue-400',
	error: 'border-red-500/30 bg-red-500/[0.07] [&>svg]:text-red-500 dark:[&>svg]:text-red-400',
	ok: 'border-emerald-500/30 bg-emerald-500/[0.07] [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400'
} as const

export function Note({ tone, children, className }: NoteProps) {
	const Icon = tone === 'info' ? Info : tone === 'error' ? AlertCircle : Check
	return (
		<div
			role={tone === 'error' ? 'alert' : undefined}
			className={cn(
				'flex items-start gap-2.5 border px-3 py-2.5 text-[12.5px] leading-relaxed',
				NOTE_TONE[tone],
				className
			)}
		>
			<Icon className='mt-0.5 h-4 w-4 flex-none' />
			<div className='min-w-0 flex-1'>{children}</div>
		</div>
	)
}
