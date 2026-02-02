import { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'

type Props = {
    icon?: ReactNode
    title: string
    description?: string
    action?: {
        label: string
        onClick: () => void
    }
    className?: string
}

export function EmptyState({ icon, title, description, action, className }: Props) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center h-full min-h-[200px] text-center p-8',
                className
            )}
        >
            {icon && <div className='text-muted-foreground mb-4 opacity-50'>{icon}</div>}
            <h3 className='text-lg font-medium text-foreground'>{title}</h3>
            {description && (
                <p className='text-muted-foreground text-sm mt-1 max-w-md'>{description}</p>
            )}
            {action && (
                <Button onClick={action.onClick} className='mt-4'>
                    {action.label}
                </Button>
            )}
        </div>
    )
}
