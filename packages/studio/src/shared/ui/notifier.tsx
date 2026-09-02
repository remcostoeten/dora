import { Notifier, notify, type NotifyOptions } from '@remcostoeten/notifier'
import type { ReactNode } from 'react'

type ToastAction = {
	label: string
	kbd?: string
	onClick: () => void
}

type ToastOptions = Omit<NotifyOptions, 'action'> & {
	description?: string
	action?: ToastAction
}

function toNotifyOptions(options?: ToastOptions): NotifyOptions | undefined {
	if (!options?.action?.kbd) return options as NotifyOptions | undefined

	const { label, kbd, onClick } = options.action
	const labelWithKbd: ReactNode = (
		<span className='inline-flex items-center gap-1.5'>
			{label}
			<kbd className='rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground'>
				{kbd}
			</kbd>
		</span>
	)

	// The library types action.label as string but renders it as a React child,
	// so a ReactNode passes through untouched.
	return {
		...options,
		action: { label: labelWithKbd as unknown as string, onClick }
	}
}

type ToastKind = 'info' | 'success' | 'error' | 'loading'

const LONG_DESCRIPTION_LENGTH = 96

function cleanText(value?: string): string | undefined {
	const text = value?.trim()
	return text ? text : undefined
}

function formatMessage(kind: ToastKind, message?: string, options?: ToastOptions): string {
	const title = cleanText(message)
	const description = cleanText(options?.description)

	if (!title) return description ?? ''
	if (!description) return title

	if (options?.action) return title

	if (description.length > LONG_DESCRIPTION_LENGTH) {
		return kind === 'error' ? description : title
	}

	// Merging a title and a description that individually fit still produces a
	// toast wide enough to span the window, so the combined line is what has to
	// stay under the budget.
	if (title.length + description.length > LONG_DESCRIPTION_LENGTH) {
		return kind === 'error' ? description : title
	}

	return `${title}: ${description}`
}

const toast = Object.assign(
	function (message?: string, options?: ToastOptions) {
		return notify.info(formatMessage('info', message, options), toNotifyOptions(options))
	},
	{
		success(message?: string, options?: ToastOptions) {
			return notify.success(
				formatMessage('success', message, options),
				toNotifyOptions(options)
			)
		},
		error(message?: string, options?: ToastOptions) {
			return notify.error(formatMessage('error', message, options), {
				dismissible: true,
				duration: 5000,
				...toNotifyOptions(options)
			})
		},
		info(message?: string, options?: ToastOptions) {
			return notify.info(formatMessage('info', message, options), toNotifyOptions(options))
		},
		loading(message?: string, options?: ToastOptions) {
			return notify.loading(
				formatMessage('loading', message, options),
				toNotifyOptions(options)
			)
		},
		dismiss(id?: string) {
			notify.dismiss(id)
		}
	}
)

function Toaster() {
	return (
		<Notifier
			position='bottom-right'
			maxVisible={3}
			duration={2800}
			// The AI assistant button sits fixed at bottom-4 right-4 (40px tall)
			// above the toast layer, so the stack starts above it.
			offset={{ x: 18, y: 64 }}
			gap={8}
			radius='rounded'
			colorMode='auto'
			iconColor='colored'
			pauseOnHover
			swipeToDismiss
			border={{
				enabled: true,
				width: 1,
				color: 'hsl(var(--border) / 0.62)'
			}}
			theme={{
				background: 'hsl(var(--popover) / 0.98)',
				text: 'hsl(var(--foreground))',
				textMuted: 'hsl(var(--muted-foreground))',
				textSubtle: 'hsl(var(--muted-foreground) / 0.72)',
				border: 'hsl(var(--border) / 0.62)',
				borderHighlight: 'hsl(var(--border))',
				buttonHover: 'hsl(var(--accent) / 0.78)',
				shadow: '0 12px 32px hsl(0 0% 0% / 0.20), 0 0 0 1px hsl(var(--foreground) / 0.035)'
			}}
		/>
	)
}

export { Toaster, toast }
