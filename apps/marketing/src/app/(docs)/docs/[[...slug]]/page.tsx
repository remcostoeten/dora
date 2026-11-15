import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle
} from 'fumadocs-ui/page'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createMetadata } from '@/core/config/seo'
import { PageActions } from '@/modules/docs/components/page-actions'
import { PageMeta } from '@/modules/docs/components/page-meta'
import { mdxComponents } from '@/modules/docs/mdx-components'
import { pageJsonLd } from '@/modules/docs/server/seo'
import { source } from '@/modules/docs/server/source'
import { SiteFooter } from '@/modules/footer'
import { Logo } from '@/modules/navigation'
import { site } from '@/shared/config/docs-site'
import { repositoryFileUrl } from '@/shared/config/repository'

type Props = {
    params: Promise<{ slug?: string[] }>
}

export const instant = false

export default async function Page({ params }: Props) {
    const { slug } = await params
    const page = source.getPage(slug)
    if (!page) notFound()

    const MDX = page.data.body
    const { tocDepth } = page.data
    const toc = tocDepth
        ? page.data.toc.filter((item) => item.depth <= tocDepth)
        : page.data.toc

    return (
        <>
            <DocsPage
                toc={toc}
                tableOfContent={{ style: 'clerk' }}
                breadcrumb={{ enabled: false }}
                footer={{ enabled: site.pageFooter.prevNext }}
            >
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: pageJsonLd(page) }}
                />
                <DocsTitle>{page.data.title}</DocsTitle>
                {page.data.description ? (
                    <DocsDescription>{page.data.description}</DocsDescription>
                ) : null}
                <PageActions markdownUrl={`${page.url}.mdx`} />
                <DocsBody>
                    <MDX components={mdxComponents} />
                </DocsBody>
                <PageMeta
                    editUrl={
                        site.pageFooter.editLink &&
                        (page.data.editUrl ??
                            repositoryFileUrl(
                                `${site.contentDir}/${page.path}`
                            ))
                    }
                    lastModified={
                        site.pageFooter.lastUpdated
                            ? page.data.lastModified
                            : undefined
                    }
                />
            </DocsPage>
            <SiteFooter
                config={site.siteFooter}
                siteName={site.name}
                logo={<Logo />}
                url={page.url}
                enabled={page.data.siteFooter}
            />
        </>
    )
}

export function generateStaticParams() {
    return source.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const page = source.getPage(slug)
    if (!page) notFound()

    return createMetadata({
        path: page.url,
        title: page.data.title ?? site.name,
        description: page.data.description ?? site.description
    })
}
