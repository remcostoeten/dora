import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'
import { getPortalContainer } from './portal-container'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal container={getPortalContainer()} {...props} />
}

// A plain element instead of DialogPrimitive.Overlay, which mounts react-remove-scroll and restyles the whole document on open and close.
const DialogOverlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
	function DialogOverlay({ className, ...props }, ref) {
		return (
			<div
				ref={ref}
				data-dialog-overlay=''
				className={cn('fixed inset-0 z-50 bg-background/80', className)}
				{...props}
			/>
		)
	}
)

const DialogContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				ref={ref}
				className={cn(
					'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-sidebar-border bg-card p-6 shadow-lg data-[state=open]:surface-enter sm:rounded-lg',
					className
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className='absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-sm opacity-70 transition-[opacity,background-color] duration-75 hover:opacity-100 hover:bg-focus focus-visible:opacity-100 focus-visible:bg-focus-strong disabled:pointer-events-none'>
					<X className='h-4 w-4' />
					<span className='sr-only'>Close</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPortal>
	)
})

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
			{...props}
		/>
	)
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
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

const DialogTitle = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
	return (
		<DialogPrimitive.Title
			ref={ref}
			className={cn('text-lg font-semibold leading-none tracking-tight', className)}
			{...props}
		/>
	)
})

const DialogDescription = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
	return (
		<DialogPrimitive.Description
			ref={ref}
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	)
})

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription
}
