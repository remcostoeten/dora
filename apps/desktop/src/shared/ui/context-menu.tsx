import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/shared/utils/cn'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(function ContextMenuSubTrigger({ className, inset, children, ...props }, ref) {
	return (
		<ContextMenuPrimitive.SubTrigger
			ref={ref}
			className={cn(
				'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden data-[state=open]:bg-sidebar-accent focus:bg-sidebar-accent',
				inset && 'pl-8',
				className
			)}
			{...props}
		>
			{children}
			<ChevronRight className='ml-auto h-4 w-4' />
		</ContextMenuPrimitive.SubTrigger>
	)
})

const ContextMenuSubContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(function ContextMenuSubContent({ className, ...props }, ref) {
	return (
		<ContextMenuPrimitive.SubContent
			ref={ref}
			className={cn(
				'z-50 min-w-32 overflow-hidden rounded-md border border-sidebar-border bg-sidebar p-1 text-sidebar-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className
			)}
			{...props}
		/>
	)
})

const ContextMenuContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className, ...props }, ref) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				ref={ref}
				className={cn(
					'z-50 min-w-32 overflow-hidden rounded-md border border-sidebar-border bg-sidebar p-1 text-sidebar-foreground shadow-lg animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					className
				)}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	)
})

const ContextMenuItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { inset?: boolean }
>(function ContextMenuItem({ className, inset, ...props }, ref) {
	return (
		<ContextMenuPrimitive.Item
			ref={ref}
			className={cn(
				'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground',
				inset && 'pl-8',
				className
			)}
			{...props}
		/>
	)
})

const ContextMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(function ContextMenuCheckboxItem({ className, children, checked, ...props }, ref) {
	return (
		<ContextMenuPrimitive.CheckboxItem
			ref={ref}
			className={cn(
				'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground',
				className
			)}
			checked={checked}
			{...props}
		>
			<span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
				<ContextMenuPrimitive.ItemIndicator>
					<Check className='h-4 w-4 text-primary' />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.CheckboxItem>
	)
})

const ContextMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(function ContextMenuRadioItem({ className, children, ...props }, ref) {
	return (
		<ContextMenuPrimitive.RadioItem
			ref={ref}
			className={cn(
				'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground',
				className
			)}
			{...props}
		>
			<span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
				<ContextMenuPrimitive.ItemIndicator>
					<Circle className='h-2 w-2 fill-current' />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.RadioItem>
	)
})

const ContextMenuLabel = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & { inset?: boolean }
>(function ContextMenuLabel({ className, inset, ...props }, ref) {
	return (
		<ContextMenuPrimitive.Label
			ref={ref}
			className={cn(
				'px-2 py-1.5 text-sm font-semibold text-sidebar-foreground-muted',
				inset && 'pl-8',
				className
			)}
			{...props}
		/>
	)
})

const ContextMenuSeparator = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(function ContextMenuSeparator({ className, ...props }, ref) {
	return (
		<ContextMenuPrimitive.Separator
			ref={ref}
			className={cn('-mx-1 my-1 h-px bg-sidebar-border', className)}
			{...props}
		/>
	)
})

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			className={cn(
				'ml-auto text-xs tracking-widest text-sidebar-foreground-muted',
				className
			)}
			{...props}
		/>
	)
}

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup
}
