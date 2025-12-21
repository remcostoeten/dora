import * as React from "react"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/core/utilities/cn"

const itemVariants = cva(
  "relative flex w-full items-center gap-3 rounded-md p-2 text-sm transition-colors",
  {
    variants: {
      variant: {
        default: "bg-background/50 hover:bg-background/70",
        outline: "border border-border hover:bg-background/70",
        muted: "bg-muted/50 hover:bg-muted/70",
      },
      size: {
        default: "py-2",
        sm: "py-1.5 px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Item = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof itemVariants> & { asChild?: boolean }
>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return (
    <Comp
      ref={ref}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Item.displayName = "Item"

const ItemContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("flex-1", className)} {...props} />
  )
})
ItemContent.displayName = "ItemContent"

const ItemTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("font-medium", className)} {...props} />
  )
})
ItemTitle.displayName = "ItemTitle"

const ItemDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
})
ItemDescription.displayName = "ItemDescription"

const ItemActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("flex-shrink-0", className)} {...props} />
  )
})
ItemActions.displayName = "ItemActions"

export {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
}