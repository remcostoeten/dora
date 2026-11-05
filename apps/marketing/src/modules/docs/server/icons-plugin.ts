import 'server-only'
import type { Node } from 'fumadocs-core/page-tree'
import type { LoaderPlugin } from 'fumadocs-core/source'
import { createElement } from 'react'
import { isIconName, namedIcons } from '@/shared/icons/icons'

function replaceIcon<TNode extends Node>(node: TNode) {
    if (typeof node.icon !== 'string') return node
    if (isIconName(node.icon)) {
        node.icon = createElement(namedIcons[node.icon])
    } else {
        console.warn(`[icons] Unknown icon "${node.icon}".`)
        node.icon = undefined
    }
    return node
}

/**
 * @name iconsPlugin
 * @description Resolves the `icon` name of pages, folders and separators to an
 * icon from `src/shared/icons`.
 *
 * @example
 * loader({ source, plugins: [iconsPlugin()] })
 */
export function iconsPlugin(): LoaderPlugin {
    return {
        name: 'icons',
        transformPageTree: {
            file: replaceIcon,
            folder: replaceIcon,
            separator: replaceIcon
        }
    }
}
