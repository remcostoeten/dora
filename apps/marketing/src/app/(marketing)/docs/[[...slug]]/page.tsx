import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { TOCItemType } from 'fumadocs-core/toc'
import type { MDXContent } from 'mdx/types.js'
import { Suspense } from 'react'

import { getMDXComponents } from '@/components/mdx-components'
import { createMetadata } from '@/core/config/seo'
import { source } from '@/lib/source'

type MdxPageData = {
    body: MDXContent
    toc: TOCItemType[]
    title?: string
    description?: string
}

type Props = {
    params: Promise<{
        slug?: string[]
    }>
}

export const instant = true

export function generateStaticParams() {
    return source.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    'use cache'

    const { slug } = await params
    const page = source.getPage(slug)

    if (!page) {
        return {}
    }

    return createMetadata({
        path: page.url,
        title: page.data.title ?? 'Dora docs',
        description: page.data.description ?? 'Documentation for Dora.'
    })
}

function DocsFallback() {
    return (
        <DocsPage toc={[]}>
            <div
                aria-busy="true"
                aria-live="polite"
                data-testid="docs-page-shell"
            >
                <DocsTitle className="font-pixel text-[2rem] font-medium leading-tight tracking-normal text-foreground">
                    Loading documentation…
                </DocsTitle>
                <DocsDescription className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                    Preparing this guide.
                </DocsDescription>
                <DocsBody className="dora-docs-body">
                    <span className="sr-only">Loading page content</span>
                    <div
                        className="grid animate-pulse gap-4"
                        aria-hidden="true"
                    >
                        <div className="h-5 w-4/5 bg-muted" />
                        <div className="h-5 w-full bg-muted" />
                        <div className="h-32 w-full bg-muted" />
                    </div>
                </DocsBody>
            </div>
        </DocsPage>
    )
}

async function DocsContent({ params }: Props) {
    const { slug } = await params
    const page = source.getPage(slug)

    if (!page) {
        notFound()
    }

    const data = page.data as MdxPageData
    const MDX = data.body

    return (
        <DocsPage toc={data.toc}>
            <DocsTitle className="font-pixel text-[2rem] font-medium leading-tight tracking-normal text-foreground">
                {data.title}
            </DocsTitle>
            <DocsDescription className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                {data.description}
            </DocsDescription>
            <DocsBody className="dora-docs-body">
                <MDX
                    components={getMDXComponents({
                        a: createRelativeLink(source, page)
                    })}
                />
            </DocsBody>
        </DocsPage>
    )
}

export default function Page({ params }: Props) {
    return (
        <Suspense fallback={<DocsFallback />}>
            <DocsContent params={params} />
        </Suspense>
    )
}
