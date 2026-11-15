import { notFound } from 'next/navigation'

import { renderMarkdown } from '@/modules/docs/server/llms'
import { source } from '@/modules/docs/server/source'

type Context = {
    params: Promise<{ slug?: string[] }>
}

export async function GET(_request: Request, { params }: Context) {
    const { slug } = await params
    const page = source.getPage(slug)
    if (!page) notFound()

    return new Response(await renderMarkdown(page), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
    })
}

export function generateStaticParams() {
    return source.generateParams()
}
