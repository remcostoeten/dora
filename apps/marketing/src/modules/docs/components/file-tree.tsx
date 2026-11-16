import {
    FileBraces,
    FileCode,
    FileCog,
    FileIcon,
    FileKey,
    FileTerminal,
    FileText,
    FileType,
    Image,
    Lock
} from 'lucide-react'
import type { ComponentType } from 'react'
import { File, Files, Folder } from 'fumadocs-ui/components/files'

type TreeNode = {
    name: string
    children?: TreeNode[]
    defaultOpen?: boolean
}

type Props = {
    tree: TreeNode[]
    className?: string
}

type Appearance = {
    icon: ComponentType<{ className?: string }>
    color: string
}

const extensionAppearance: Record<string, Appearance> = {
    ts: { icon: FileCode, color: 'text-sky-600 dark:text-sky-400' },
    tsx: { icon: FileCode, color: 'text-sky-600 dark:text-sky-400' },
    js: { icon: FileCode, color: 'text-amber-600 dark:text-amber-400' },
    jsx: { icon: FileCode, color: 'text-amber-600 dark:text-amber-400' },
    mjs: { icon: FileCode, color: 'text-amber-600 dark:text-amber-400' },
    json: { icon: FileBraces, color: 'text-orange-600 dark:text-orange-400' },
    mdx: { icon: FileText, color: 'text-violet-600 dark:text-violet-400' },
    md: { icon: FileText, color: 'text-violet-600 dark:text-violet-400' },
    css: { icon: FileType, color: 'text-pink-600 dark:text-pink-400' },
    sh: { icon: FileTerminal, color: 'text-emerald-600 dark:text-emerald-400' },
    yml: { icon: FileCog, color: 'text-rose-600 dark:text-rose-400' },
    yaml: { icon: FileCog, color: 'text-rose-600 dark:text-rose-400' },
    lock: { icon: Lock, color: 'text-zinc-500' },
    png: { icon: Image, color: 'text-teal-600 dark:text-teal-400' },
    svg: { icon: Image, color: 'text-teal-600 dark:text-teal-400' },
    ico: { icon: Image, color: 'text-teal-600 dark:text-teal-400' }
}

const fallback: Appearance = {
    icon: FileIcon,
    color: 'text-fd-muted-foreground'
}
const environment: Appearance = {
    icon: FileKey,
    color: 'text-lime-600 dark:text-lime-400'
}

function appearanceOf(name: string) {
    if (name.startsWith('.env')) return environment
    const extension = name.split('.').pop() ?? ''
    return extensionAppearance[extension] ?? fallback
}

function Node({ node }: { node: TreeNode }) {
    if (node.children) {
        return (
            <Folder
                name={node.name}
                defaultOpen={node.defaultOpen}
                className="[&>button_svg]:text-indigo-600 dark:[&>button_svg]:text-indigo-400"
            >
                {node.children.map((child) => (
                    <Node key={child.name} node={child} />
                ))}
            </Folder>
        )
    }

    const { icon: Icon, color } = appearanceOf(node.name)
    return <File name={node.name} icon={<Icon className={color} />} />
}

/**
 * @name FileTree
 * @description Project structure from data instead of JSX children. Files get
 * an icon and colour by extension, and folders are indigo. A node
 * with `children` is a folder, any other node is a file.
 *
 * @example
 * <FileTree tree={[{ name: "src", defaultOpen: true, children: [{ name: "index.ts" }] }]} />
 */
export function FileTree({ tree, className }: Props) {
    return (
        <Files className={className}>
            {tree.map((node) => (
                <Node key={node.name} node={node} />
            ))}
        </Files>
    )
}
