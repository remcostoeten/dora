import {
    CircleAlert,
    CircleCheck,
    Info,
    Lightbulb,
    TriangleAlert
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/helpers/cn'

type CalloutType = 'info' | 'warn' | 'warning' | 'error' | 'success' | 'idea'

type Props = {
    type?: CalloutType
    title?: ReactNode
    icon?: ReactNode
    className?: string
    children?: ReactNode
}

const icons = {
    info: <Info />,
    warn: <TriangleAlert />,
    error: <CircleAlert />,
    success: <CircleCheck />,
    idea: <Lightbulb />
}

function normalize(type: CalloutType | undefined) {
    return type === 'warning' ? 'warn' : type
}

export function Callout({ type, title, icon, className, children }: Props) {
    const kind = normalize(type ?? 'info')
    const glyph = icon === undefined && kind ? icons[kind] : icon

    return (
        <div
            role="note"
            data-callout={kind}
            className={cn('callout', className)}
        >
            {glyph ? <span className="callout-icon">{glyph}</span> : null}
            <div className="callout-body">
                {title ? <p className="callout-title">{title}</p> : null}
                <div className="callout-content">{children}</div>
            </div>
        </div>
    )
}
