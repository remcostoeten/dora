import {
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger
} from 'fumadocs-ui/components/codeblock'
import type { ComponentProps } from 'react'
import { cn } from '@/shared/helpers/cn'

export function CodeTabs({
    className,
    ...props
}: ComponentProps<typeof CodeBlockTabs>) {
    return <CodeBlockTabs className={cn('code-tabs', className)} {...props} />
}

export function CodeTabsList({
    className,
    ...props
}: ComponentProps<typeof CodeBlockTabsList>) {
    return (
        <CodeBlockTabsList
            className={cn('code-tabs-list', className)}
            {...props}
        />
    )
}

export function CodeTabsTrigger({
    className,
    ...props
}: ComponentProps<typeof CodeBlockTabsTrigger>) {
    return (
        <CodeBlockTabsTrigger
            className={cn('code-tabs-trigger', className)}
            {...props}
        />
    )
}

export function CodeTab({
    className,
    ...props
}: ComponentProps<typeof CodeBlockTab>) {
    return <CodeBlockTab className={cn('code-tab', className)} {...props} />
}
