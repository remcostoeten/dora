import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiModelOption } from '@studio/lib/bindings'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	value: string
	onChange: (value: string) => void
	options: AiModelOption[]
	disabled?: boolean
	placeholder?: string
	className?: string
}

const MAX_SUGGESTIONS = 12

export function filterModelOptions(options: AiModelOption[], query: string): AiModelOption[] {
	const normalized = query.trim().toLowerCase()
	const matches = normalized
		? options.filter(function (option) {
				return (
					option.id.toLowerCase().includes(normalized) ||
					option.label.toLowerCase().includes(normalized)
				)
			})
		: options

	return matches.slice(0, MAX_SUGGESTIONS)
}

export function ModelIdInput({
	value,
	onChange,
	options,
	disabled,
	placeholder,
	className
}: Props) {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const suggestions = useMemo(
		function () {
			return filterModelOptions(options, value)
		},
		[options, value]
	)

	useEffect(function handleClickOutside() {
		function onPointerDown(event: PointerEvent) {
			if (!containerRef.current?.contains(event.target as Node)) {
				setOpen(false)
			}
		}

		document.addEventListener('pointerdown', onPointerDown)
		return function () {
			document.removeEventListener('pointerdown', onPointerDown)
		}
	}, [])

	return (
		<div ref={containerRef} className='relative'>
			<Input
				value={value}
				disabled={disabled}
				onChange={function (event) {
					onChange(event.target.value)
					setOpen(true)
				}}
				onFocus={function () {
					setOpen(true)
				}}
				onKeyDown={function (event) {
					if (event.key === 'Escape') {
						setOpen(false)
					}
				}}
				placeholder={placeholder}
				className={className}
				autoComplete='off'
				spellCheck={false}
			/>
			{open && !disabled && suggestions.length > 0 ? (
				<div
					className='absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-sidebar-border bg-sidebar py-1 shadow-lg'
					role='listbox'
				>
					{suggestions.map(function (option) {
						return (
							<button
								key={option.id}
								type='button'
								role='option'
								className={cn(
									'flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left',
									'transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-hidden'
								)}
								onMouseDown={function (event) {
									event.preventDefault()
									onChange(option.id)
									setOpen(false)
								}}
							>
								<span className='font-mono text-xs text-sidebar-foreground'>
									{option.id}
								</span>
								{option.label !== option.id ? (
									<span className='text-[10px] text-muted-foreground'>
										{option.label}
									</span>
								) : null}
							</button>
						)
					})}
				</div>
			) : null}
		</div>
	)
}
