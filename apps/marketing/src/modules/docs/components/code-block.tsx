import type { ComponentProps } from 'react'
import { cn } from '@/shared/helpers/cn'
import { CopyButton } from './copy-button'

type Props = ComponentProps<'pre'> & {
    title?: string
    icon?: unknown
    allowCopy?: string
    'data-language'?: string
    'data-line-numbers'?: boolean
    'data-line-numbers-start'?: number
}

const languageLabels: Record<string, string> = {
    bash: 'sh',
    shell: 'sh',
    sh: 'sh',
    plaintext: 'txt',
    text: 'txt'
}

function languageLabel(language: string | undefined) {
    if (!language) return undefined
    return languageLabels[language] ?? language
}

export function CodeBlock({
    title,
    icon: _icon,
    allowCopy,
    className,
    style,
    children,
    'data-language': language,
    'data-line-numbers': lineNumbers,
    'data-line-numbers-start': lineNumbersStart,
    ...props
}: Props) {
    if (!language) {
        return (
            <pre className={className} style={style} {...props}>
                {children}
            </pre>
        )
    }

    const label = languageLabel(language)
    const copyable = allowCopy !== 'false'

    return (
        <div className="not-fumadocs-codeblock contents">
            <figure
                data-code-block=""
                data-line-numbers={lineNumbers || undefined}
                className={cn('code-block not-prose', className)}
                style={
                    lineNumbersStart
                        ? {
                              ...style,
                              counterReset: `line ${lineNumbersStart - 1}`
                          }
                        : style
                }
            >
                {title ? (
                    <figcaption className="code-block-header">
                        {label ? (
                            <span className="code-block-language">{label}</span>
                        ) : null}
                        <span className="min-w-0 grow truncate">{title}</span>
                        {copyable ? <CopyButton className="-me-1.5" /> : null}
                    </figcaption>
                ) : null}
                {!title && copyable ? (
                    <CopyButton className="code-block-floating" />
                ) : null}
                <div className="code-block-viewport">
                    <pre {...props}>{children}</pre>
                </div>
            </figure>
        </div>
    )
}
