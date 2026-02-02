import { AlertTriangle } from 'lucide-react'

type Props = {
    feature: string
    description?: string
}

export function NotImplemented({ feature, description }: Props) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">{feature}</h3>
                <p className="text-xs text-muted-foreground">
                    {description || 'This feature is coming soon'}
                </p>
            </div>
        </div>
    )
}
