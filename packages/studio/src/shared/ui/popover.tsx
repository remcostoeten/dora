import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { useIsMobile } from '@studio/shared/hooks/use-mobile'
import { cn } from '@studio/shared/utils/cn'

const DRAWER_DISMISS_DISTANCE = 80
const DRAWER_DISMISS_VELOCITY = 0.5

type DrawerState = {
	isDrawer: boolean
	close: () => void
}

const DrawerContext = React.createContext<DrawerState>({
	isDrawer: false,
	close: () => {}
})

function Popover({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	modal,
	children
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	const isMobile = useIsMobile()
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
	const open = openProp ?? uncontrolledOpen

	const setOpen = React.useCallback(
		(next: boolean) => {
			if (openProp === undefined) setUncontrolledOpen(next)
			onOpenChange?.(next)
		},
		[openProp, onOpenChange]
	)

	const drawerState = React.useMemo(
		() => ({ isDrawer: isMobile, close: () => setOpen(false) }),
		[isMobile, setOpen]
	)

	return (
		<DrawerContext.Provider value={drawerState}>
			{isMobile ? (
				<DialogPrimitive.Root open={open} onOpenChange={setOpen}>
					{children}
				</DialogPrimitive.Root>
			) : (
				<PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={modal}>
					{children}
				</PopoverPrimitive.Root>
			)}
		</DrawerContext.Provider>
	)
}

const PopoverTrigger = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(function PopoverTrigger(props, ref) {
	const { isDrawer } = React.useContext(DrawerContext)
	if (isDrawer) return <DialogPrimitive.Trigger ref={ref} {...props} />
	return <PopoverPrimitive.Trigger ref={ref} {...props} />
})

const PopoverClose = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Close>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Close>
>(function PopoverClose(props, ref) {
	const { isDrawer } = React.useContext(DrawerContext)
	if (isDrawer) return <DialogPrimitive.Close ref={ref} {...props} />
	return <PopoverPrimitive.Close ref={ref} {...props} />
})

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }, ref) {
	const { isDrawer } = React.useContext(DrawerContext)

	if (isDrawer) {
		return (
			<DrawerContent ref={ref} className={className}>
				{props.children}
			</DrawerContent>
		)
	}

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				ref={ref}
				align={align}
				sideOffset={sideOffset}
				className={cn(
					'z-50 w-72 rounded-md border border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-lg outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					className
				)}
				style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	)
})

type DrawerContentProps = {
	className?: string
	children?: React.ReactNode
}

const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
	function DrawerContent({ className, children }, forwardedRef) {
		const { close } = React.useContext(DrawerContext)
		const contentRef = React.useRef<HTMLDivElement | null>(null)
		const dragRef = React.useRef<{ startY: number; startTime: number; offset: number } | null>(
			null
		)

		const setRefs = React.useCallback(
			(node: HTMLDivElement | null) => {
				contentRef.current = node
				if (typeof forwardedRef === 'function') forwardedRef(node)
				else if (forwardedRef) forwardedRef.current = node
			},
			[forwardedRef]
		)

		function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
			event.currentTarget.setPointerCapture(event.pointerId)
			dragRef.current = { startY: event.clientY, startTime: event.timeStamp, offset: 0 }
			if (contentRef.current) contentRef.current.style.transition = 'none'
		}

		function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
			const drag = dragRef.current
			const content = contentRef.current
			if (!drag || !content) return
			drag.offset = Math.max(0, event.clientY - drag.startY)
			content.style.transform = `translateY(${drag.offset}px)`
		}

		function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
			const drag = dragRef.current
			const content = contentRef.current
			dragRef.current = null
			if (!drag || !content) return
			const velocity = drag.offset / Math.max(1, event.timeStamp - drag.startTime)
			content.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
			if (drag.offset > DRAWER_DISMISS_DISTANCE || velocity > DRAWER_DISMISS_VELOCITY) {
				content.style.transform = 'translateY(100%)'
				close()
				return
			}
			content.style.transform = ''
		}

		return (
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
				<DialogPrimitive.Content
					ref={setRefs}
					aria-describedby={undefined}
					className='fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground shadow-lg outline-hidden duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
				>
					<DialogPrimitive.Title className='sr-only'>Panel</DialogPrimitive.Title>
					<div
						className='flex shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing'
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerCancel={handlePointerUp}
					>
						<div className='h-1 w-10 rounded-full bg-muted-foreground/40' />
					</div>
					<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
						<div className={cn('w-full p-4', className, 'm-0 w-full max-w-none')}>
							{children}
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		)
	}
)

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
