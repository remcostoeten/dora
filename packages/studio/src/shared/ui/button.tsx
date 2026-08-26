import { Slot } from '@radix-ui/react-slot'
import { cva, VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:bg-primary/78 active:bg-primary/70',
				destructive:
					'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:bg-destructive/78 active:bg-destructive/70',
				outline:
					'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-focus-strong',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:bg-secondary/60 active:bg-secondary/50',
				ghost: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-focus focus-visible:text-sidebar-accent-foreground active:bg-focus-strong',
				link: 'text-primary underline-offset-4 hover:underline focus-visible:bg-focus focus-visible:underline',
				sidebar:
					'bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 focus-visible:bg-focus-strong justify-start',
				'sidebar-ghost':
					'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-focus focus-visible:text-sidebar-accent-foreground active:bg-focus-strong justify-start'
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-8 rounded-md px-3 text-xs',
				lg: 'h-11 rounded-md px-8',
				icon: 'h-8 w-8',
				'icon-sm': 'h-7 w-7'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
)

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean
	}

const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
	{ className, variant, size, asChild = false, ...props },
	ref
) {
	const Comp = asChild ? Slot : 'button'
	return (
		<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
	)
})

export { Button, buttonVariants }
