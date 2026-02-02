import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/shared/lib/utils'

type Props = {
    title?: string
    message: string
    onRetry?: () => void
    className?: string
}

export function ErrorState({ title, message, onRetry, className }: Props) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-4 p-8 text-center', className)}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
                {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
                <p className="text-xs text-muted-foreground max-w-[300px]">{message}</p>
            </div>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                </Button>
            )}
        </div>
    )
}
