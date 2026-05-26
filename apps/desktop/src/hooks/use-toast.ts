import * as React from 'react'
import type { NotifyOptions } from '@remcostoeten/notifier'
import { toast as appToast } from '@/shared/ui/notifier'

type ToastVariant = 'default' | 'info' | 'success' | 'destructive'

type ToastOptions = {
	title?: React.ReactNode
	description?: React.ReactNode
	variant?: ToastVariant
	duration?: number
	dismissible?: boolean
	action?: NotifyOptions['action']
}

function toToastText(value: React.ReactNode): string | undefined {
	if (value === null || value === undefined || typeof value === 'boolean') return undefined
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'bigint') return String(value)
	return undefined
}

function toast({
	title,
	description,
	variant = 'default',
	duration,
	dismissible,
	action
}: ToastOptions) {
	const message = toToastText(title) ?? toToastText(description)
	const options = {
		description: title ? toToastText(description) : undefined,
		duration,
		dismissible,
		action
	}

	if (variant === 'destructive') {
		const instance = appToast.error(message, options)
		return {
			id: instance.id,
			dismiss: function () {
				instance.dismiss()
			},
			update: function (props: ToastOptions) {
				return toast(props)
			}
		}
	}

	if (variant === 'success') {
		const instance = appToast.success(message, options)
		return {
			id: instance.id,
			dismiss: function () {
				instance.dismiss()
			},
			update: function (props: ToastOptions) {
				return toast(props)
			}
		}
	}

	const instance = appToast.info(message, options)
	return {
		id: instance.id,
		dismiss: function () {
			instance.dismiss()
		},
		update: function (props: ToastOptions) {
			return toast(props)
		}
	}
}

function useToast() {
	return {
		toasts: [],
		toast,
		dismiss: function (toastId?: string) {
			appToast.dismiss(toastId)
		}
	}
}

export { useToast, toast }
