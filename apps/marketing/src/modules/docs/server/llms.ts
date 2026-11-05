import 'server-only'
import { llms } from 'fumadocs-core/source/llms'
import { source } from './source'

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>

/**
 * @name renderMarkdown
 * @description Renders a docs page as plain Markdown with its title, URL and
 * description, for LLMs and the copy-as-Markdown button.
 *
 * @example
 * const markdown = await renderMarkdown(page)
 */
export async function renderMarkdown(page: DocsPage) {
    const body = await page.data.getText('processed')
    const description = page.data.description
        ? `\n\n${page.data.description}`
        : ''
    return `# ${page.data.title} (${page.url})${description}\n\n${body}`
}

/**
 * @name docsLlms
 * @description Builds `llms.txt` and `llms-full.txt` from the docs source.
 *
 * @example
 * const index = docsLlms.index()
 */
export const docsLlms = llms(source, { renderPage: renderMarkdown })
