import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'
import { getPortalContainer } from './portal-container'

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

function AlertDialogPortal(props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
	return <AlertDialogPrimitive.Portal container={getPortalContainer()} {...props} />
}

// A plain element instead of AlertDialogPrimitive.Overlay, which mounts react-remove-scroll and restyles the whole document on open and close.
const AlertDialogOverlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
	function AlertDialogOverlay({ className, ...props }, ref) {
		return (
			<div
				ref={ref}
				data-dialog-overlay=''
				className={cn('fixed inset-0 z-50 bg-black/80', className)}
				{...props}
			/>
		)
	}
)

const AlertDialogContent = React.forwardRef<
	React.ElementRef<typeof AlertDialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(function AlertDialogContent({ className, ...props }, ref) {
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Content
				ref={ref}
				className={cn(
					'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-sidebar-border bg-background p-6 shadow-lg data-[state=open]:surface-enter sm:rounded-lg',
					className
				)}
				{...props}
			/>
		</AlertDialogPortal>
	)
})

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
			{...props}
		/>
	)
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
				className
			)}
			{...props}
		/>
	)
}

const AlertDialogTitle = React.forwardRef<
	React.ElementRef<typeof AlertDialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(function AlertDialogTitle({ className, ...props }, ref) {
	return (
		<AlertDialogPrimitive.Title
			ref={ref}
			className={cn('text-lg font-semibold text-foreground', className)}
			{...props}
		/>
	)
})

const AlertDialogDescription = React.forwardRef<
	React.ElementRef<typeof AlertDialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(function AlertDialogDescription({ className, ...props }, ref) {
	return (
		<AlertDialogPrimitive.Description
			ref={ref}
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	)
})

const AlertDialogAction = React.forwardRef<
	React.ElementRef<typeof AlertDialogPrimitive.Action>,
	React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(function AlertDialogAction({ className, ...props }, ref) {
	return (
		<AlertDialogPrimitive.Action
			ref={ref}
			className={cn(
				'inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-[background-color,color] duration-75 ease-[var(--ease-out)] hover:bg-destructive/90 focus-visible:bg-destructive/78 active:bg-destructive/70 disabled:pointer-events-none disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
})

const AlertDialogCancel = React.forwardRef<
	React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
	React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(function AlertDialogCancel({ className, ...props }, ref) {
	return (
		<AlertDialogPrimitive.Cancel
			ref={ref}
			className={cn(
				'inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-[background-color,color] duration-75 ease-[var(--ease-out)] hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-focus-strong disabled:pointer-events-none disabled:opacity-50 sm:mt-0',
				className
			)}
			{...props}
		/>
	)
})

export {
	AlertDialog,
	AlertDialogPortal,
	AlertDialogOverlay,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogAction,
	AlertDialogCancel
}
