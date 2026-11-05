import { RotateCcw, Keyboard } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { formatShortcutList, type ShortcutConflictEventDetail } from '@studio/core/shortcuts'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	value: string | string[]
	onChange: (value: string | string[]) => boolean | void
	onReset: () => void
	isDefault: boolean
	actionLabel: string
	conflict?: string | null
}

export function ShortcutRecorder({
	value,
	onChange,
	onReset,
	isDefault,
	actionLabel,
	conflict
}: Props) {
	const [isRecording, setIsRecording] = useState(false)
	const [tempCombo, setTempCombo] = useState<string | null>(null)
	const [internalConflict, setInternalConflict] = useState<string | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	useEffect(
		function () {
			if (!isRecording) return

			function handleKeyDown(e: KeyboardEvent) {
				e.preventDefault()
				e.stopPropagation()

				if (e.key === 'Escape') {
					setIsRecording(false)
					setTempCombo(null)
					setInternalConflict(null)
					buttonRef.current?.focus()
					return
				}

				// Ignore standalone (non-modifier) key releases or just plain modifiers being pressed
				if (
					['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'ContextMenu'].includes(e.key)
				) {
					return
				}

				const modifiers: string[] = []
				if (e.ctrlKey) modifiers.push('ctrl')
				if (e.metaKey) modifiers.push('mod') // map meta to mod for cross-platform
				if (e.altKey) modifiers.push('alt')
				if (e.shiftKey) modifiers.push('shift')

				let key = e.key.toLowerCase()

				// Map special keys
				if (key === ' ') key = 'space'
				if (key === 'escape') key = 'escape'
				if (key === 'arrowup') key = 'up'
				if (key === 'arrowdown') key = 'down'
				if (key === 'arrowleft') key = 'left'
				if (key === 'arrowright') key = 'right'

				const combo = [...modifiers, key].join('+')
				setTempCombo(combo)
				setInternalConflict(null)
			}

			function handleKeyUp(_e: KeyboardEvent) {
				if (tempCombo) {
					const nextValue = Array.isArray(value)
						? [tempCombo, ...value.slice(1)]
						: tempCombo
					const accepted = onChange(nextValue)

					if (accepted !== false) {
						setIsRecording(false)
						setTempCombo(null)
					}
				}
			}

			window.addEventListener('keydown', handleKeyDown)
			window.addEventListener('keyup', handleKeyUp)

			return function () {
				window.removeEventListener('keydown', handleKeyDown)
				window.removeEventListener('keyup', handleKeyUp)
			}
		},
		[isRecording, onChange, tempCombo, value]
	)

	useEffect(
		function () {
			function handleShortcutConflict(event: Event) {
				const detail = (event as CustomEvent<ShortcutConflictEventDetail>).detail
				if (!detail || !tempCombo) return

				const requested = detail.requestedCombo
				const requestedPrimary = Array.isArray(requested) ? requested[0] : requested
				if (requestedPrimary !== tempCombo) return

				setInternalConflict(detail.message)
			}

			window.addEventListener('dora-shortcut-conflict', handleShortcutConflict)
			return function () {
				window.removeEventListener('dora-shortcut-conflict', handleShortcutConflict)
			}
		},
		[tempCombo]
	)

	// Handle clicking outside to cancel
	useEffect(
		function () {
			if (!isRecording) return

			function handleClickOutside(e: MouseEvent) {
				if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
					setIsRecording(false)
					setTempCombo(null)
				}
			}

			window.addEventListener('mousedown', handleClickOutside)
			return function () {
				window.removeEventListener('mousedown', handleClickOutside)
			}
		},
		[isRecording]
	)

	const displayValue = tempCombo
		? Array.isArray(value)
			? [tempCombo, ...value.slice(1)]
			: tempCombo
		: value
	const formatted = tempCombo ? formatShortcutList(displayValue) : formatShortcutList(value)
	const conflictMessage = conflict ?? internalConflict

	return (
		<div className='flex flex-col items-end gap-1'>
			<div className='flex items-center gap-2'>
				<Button
					ref={buttonRef}
					data-shortcut-recording={isRecording ? 'true' : undefined}
					aria-label={
						isRecording
							? `Recording shortcut for ${actionLabel}. Press Escape to cancel.`
							: `Edit shortcut for ${actionLabel}. Current shortcut: ${formatted}`
					}
					aria-pressed={isRecording}
					variant={
						isRecording ? 'destructive' : conflictMessage ? 'destructive' : 'outline'
					}
					size='sm'
					className={cn(
						'min-w-[120px] max-w-[260px] justify-between font-mono text-xs',
						isRecording && 'animate-pulse'
					)}
					onClick={function () {
						setInternalConflict(null)
						setIsRecording(true)
					}}
				>
					{isRecording ? (
						<span>Press keys...</span>
					) : (
						<span className='flex min-w-0 items-center gap-2'>
							<Keyboard className='h-3 w-3 shrink-0 text-muted-foreground' />
							<span className='truncate'>{formatted}</span>
						</span>
					)}
				</Button>

				{!isDefault && (
					<Button
						variant='ghost'
						size='icon'
						className='h-8 w-8'
						aria-label={`Reset shortcut for ${actionLabel} to default`}
						onClick={function () {
							setInternalConflict(null)
							onReset()
						}}
					>
						<RotateCcw className='w-3 h-3' />
					</Button>
				)}
			</div>

			{conflictMessage ? (
				<div className='max-w-[260px] text-right text-[10px] leading-tight text-destructive'>
					{conflictMessage}
				</div>
			) : null}
		</div>
	)
}
