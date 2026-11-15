import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import {
    BookIcon,
    CloudIcon,
    CompassIcon,
    DownloadIcon,
    PageIcon,
    PaletteIcon,
    RocketIcon,
    RouteIcon,
    SearchIcon
} from '@/shared/icons/icons'
import { Callout } from './components/callout'
import { CodeBlock } from './components/code-block'
import { DocsTab, DocsTabs } from './components/docs-tabs'
import { FileTree } from './components/file-tree'
import {
    CodeTab,
    CodeTabs,
    CodeTabsList,
    CodeTabsTrigger
} from './components/code-tabs'

/**
 * @name mdxComponents
 * @description Components available in every MDX page: the Fumadocs defaults
 * plus tabs, steps, accordions, file trees (JSX and data driven), the site icons and
 * the custom code block.
 *
 * @example
 * <MDX components={mdxComponents} />
 */
export const mdxComponents: MDXComponents = {
    ...defaultMdxComponents,
    pre: CodeBlock,
    CodeBlockTab: CodeTab,
    CodeBlockTabs: CodeTabs,
    CodeBlockTabsList: CodeTabsList,
    CodeBlockTabsTrigger: CodeTabsTrigger,
    Accordion,
    Accordions,
    Callout,
    File,
    FileTree,
    Files,
    Folder,
    Step,
    Steps,
    Tab: DocsTab,
    Tabs: DocsTabs,
    BookIcon,
    CloudIcon,
    CompassIcon,
    DownloadIcon,
    PageIcon,
    PaletteIcon,
    RocketIcon,
    RouteIcon,
    SearchIcon
}
