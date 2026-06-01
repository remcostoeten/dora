import { Notifier, notify, type NotifyOptions } from '@remcostoeten/notifier'

type ToastOptions = NotifyOptions & {
	description?: string
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

	return `${title}: ${description}`
}

const toast = Object.assign(
	function (message?: string, options?: ToastOptions) {
		return notify.info(formatMessage('info', message, options), options)
	},
	{
		success(message?: string, options?: ToastOptions) {
			return notify.success(formatMessage('success', message, options), options)
		},
		error(message?: string, options?: ToastOptions) {
			return notify.error(formatMessage('error', message, options), {
				dismissible: true,
				duration: 5000,
				...options
			})
		},
		info(message?: string, options?: ToastOptions) {
			return notify.info(formatMessage('info', message, options), options)
		},
		loading(message?: string, options?: ToastOptions) {
			return notify.loading(formatMessage('loading', message, options), options)
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
			offset={{ x: 18, y: 18 }}
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
				shadow:
					'0 12px 32px hsl(0 0% 0% / 0.20), 0 0 0 1px hsl(var(--foreground) / 0.035)'
			}}
		/>
	)
}

export { Toaster, toast }
