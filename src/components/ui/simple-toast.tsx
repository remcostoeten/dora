import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/core/utilities/cn'
import { X } from 'lucide-react'

const toastVariants = cva(
  'relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all animate-slide-up',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground shadow-lg',
        success: 'border-success/50 bg-success text-success-foreground shadow-lg',
        error: 'border-error/50 bg-error text-error-foreground shadow-lg',
        warning: 'border-warning/50 bg-warning text-warning-foreground shadow-lg',
        info: 'border-primary/50 bg-primary/10 text-foreground shadow-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface SimpleToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  duration?: number
  onClose?: () => void
}

export function SimpleToast({
  className,
  variant,
  title,
  description,
  duration = 5000,
  onClose,
  ...props
}: SimpleToastProps) {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(() => onClose?.(), 300) // Wait for fade out animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onClose?.(), 300)
  }

  if (!visible) {
    return null
  }

  return (
    <div
      className={cn(
        toastVariants({ variant }),
        visible ? 'animate-slide-up opacity-100' : 'animate-fade-out opacity-0',
        'transition-all duration-300',
        className
      )}
      {...props}
    >
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      <button
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-hover:opacity-100"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  )
}

// Simple container for managing multiple toasts without context
export function SimpleToastContainer({
  toasts,
  onRemove
}: {
  toasts: Array<{ id: string } & SimpleToastProps>
  onRemove: (id: string) => void
}) {
  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <div key={toast.id} className="mb-2">
          <SimpleToast
            {...toast}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}