import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/shared/helpers/cn'

export function DocsTabs({ className, ...props }: ComponentProps<typeof Tabs>) {
    return <Tabs className={cn('docs-tabs', className)} {...props} />
}

export function DocsTab({ className, ...props }: ComponentProps<typeof Tab>) {
    return <Tab className={cn('docs-tab', className)} {...props} />
}
