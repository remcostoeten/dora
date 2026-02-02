import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'
import type { ComponentProps, ReactNode } from 'react'

type Props = {
    feature: string
    children: ReactNode
    variant?: ComponentProps<typeof Button>['variant']
    size?: ComponentProps<typeof Button>['size']
    className?: string
    showToast?: boolean
}

export function DisabledFeature({
    feature,
    children,
    variant = 'ghost',
    size = 'sm',
    className,
    showToast = true
}: Props) {
    function handleClick() {
        if (showToast) {
            toast.info(`${feature} is coming soon`, {
                description: 'This feature is not yet implemented'
            })
        }
    }

    return (
        <Button
            variant={variant}
            size={size}
            disabled
            className={cn('cursor-not-allowed opacity-50', className)}
            onClick={handleClick}
            title={`${feature} - Coming soon`}
        >
            {children}
        </Button>
    )
}
