import { builtinModules } from 'node:module'

const builtinSet = new Set()

for (const name of builtinModules) {
    builtinSet.add(name)
    builtinSet.add(`node:${name}`)
}

function isBuiltin(source) {
    return builtinSet.has(source)
}

function isInternal(source) {
    return source.startsWith('@/') || source.startsWith('.')
}

function getGroup(source) {
    if (isBuiltin(source)) {
        return 0
    }

    if (isInternal(source)) {
        return 2
    }

    return 1
}

function getName(node) {
    if (!node) {
        return ''
    }

    if (node.type === 'Identifier') {
        return node.name
    }

    return ''
}

function trimPrefix(name) {
    if (name.startsWith('T') && name.length > 1) {
        return name.slice(1)
    }

    return name
}

function splitName(name) {
    const clean = name.replace(/^[\W_]+|[\W_]+$/g, '')

    if (!clean) {
        return []
    }

    const parts = clean.match(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+/g)

    return parts || [clean]
}

function countWords(name) {
    return splitName(name).length
}

function isPage(file) {
    return file.endsWith('/page.tsx') || file.endsWith('\\page.tsx')
}

function getImport(node) {
    if (!node.specifiers || node.specifiers.length === 0) {
        return ''
    }

    const spec = node.specifiers[0]

    if (
        spec.type === 'ImportSpecifier' ||
        spec.type === 'ImportDefaultSpecifier' ||
        spec.type === 'ImportNamespaceSpecifier'
    ) {
        return spec.local.name
    }

    return ''
}

function checkName(context, node, name, kind, prefixOk) {
    const actual = prefixOk ? trimPrefix(name) : name

    if (countWords(actual) > 2) {
        context.report({
            node,
            message: `${kind} name "${name}" must stay within two words`
        })
    }
}

const functionRule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Allow function declarations only.'
        },
        messages: {
            arrow: 'Arrow functions are not allowed.',
            expr: 'Function expressions are not allowed.',
            class: 'Classes are not allowed.',
            iface: 'Interfaces are not allowed.'
        }
    },
    create(context) {
        return {
            ArrowFunctionExpression(node) {
                context.report({
                    node,
                    messageId: 'arrow'
                })
            },
            FunctionExpression(node) {
                context.report({
                    node,
                    messageId: 'expr'
                })
            },
            ClassDeclaration(node) {
                context.report({
                    node,
                    messageId: 'class'
                })
            },
            ClassExpression(node) {
                context.report({
                    node,
                    messageId: 'class'
                })
            },
            TSInterfaceDeclaration(node) {
                context.report({
                    node,
                    messageId: 'iface'
                })
            }
        }
    }
}

const typeRule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prefix local types with T.'
        }
    },
    create(context) {
        return {
            TSTypeAliasDeclaration(node) {
                const name = getName(node.id)

                if (!name.startsWith('T')) {
                    context.report({
                        node: node.id,
                        message: 'Type alias names must start with T.'
                    })
                }
            }
        }
    }
}

const nameRule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Limit local identifier names to two words.'
        }
    },
    create(context) {
        return {
            FunctionDeclaration(node) {
                const name = getName(node.id)

                if (name) {
                    checkName(context, node.id, name, 'Function', false)
                }
            },
            VariableDeclarator(node) {
                const name = getName(node.id)

                if (name) {
                    checkName(context, node.id, name, 'Variable', false)
                }
            },
            TSTypeAliasDeclaration(node) {
                const name = getName(node.id)

                if (name) {
                    checkName(context, node.id, name, 'Type', true)
                }
            },
            ImportSpecifier(node) {
                const name = getName(node.local)

                if (name) {
                    checkName(context, node.local, name, 'Import', false)
                }
            },
            ImportDefaultSpecifier(node) {
                const name = getName(node.local)

                if (name) {
                    checkName(context, node.local, name, 'Import', false)
                }
            },
            ImportNamespaceSpecifier(node) {
                const name = getName(node.local)

                if (name) {
                    checkName(context, node.local, name, 'Import', false)
                }
            }
        }
    }
}

const orderRule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Keep imports grouped by builtin, external, then internal.'
        }
    },
    create(context) {
        const imports = []

        return {
            ImportDeclaration(node) {
                imports.push({
                    group: getGroup(node.source.value),
                    node
                })
            },
            'Program:exit'() {
                imports.sort(function compareImports(left, right) {
                    return left.node.start - right.node.start
                })

                let lastGroup = -1

                for (const entry of imports) {
                    if (entry.group < lastGroup) {
                        context.report({
                            node: entry.node,
                            message:
                                'Import order must be builtin, external, then internal.'
                        })
                        return
                    }

                    lastGroup = entry.group
                }
            }
        }
    }
}

function pageCheck(context, node) {
    const file = context.filename

    if (!isPage(file)) {
        return
    }

    const body = node.body
    let metadata = null
    let pageFn = null
    const viewNames = []

    for (const stmt of body) {
        if (stmt.type === 'ImportDeclaration') {
            if (stmt.source.value === '@/views') {
                const name = getImport(stmt)

                if (name) {
                    viewNames.push(name)
                }
            }

            continue
        }

        if (stmt.type === 'ExportNamedDeclaration') {
            if (
                stmt.declaration &&
                stmt.declaration.type === 'VariableDeclaration' &&
                stmt.declaration.declarations.length === 1
            ) {
                const decl = stmt.declaration.declarations[0]
                const name = getName(decl.id)

                if (name === 'metadata') {
                    metadata = decl
                    continue
                }
            }

            context.report({
                node: stmt,
                message:
                    'Page files may only export metadata and the default page component.'
            })
            return
        }

        if (stmt.type === 'ExportDefaultDeclaration') {
            if (stmt.declaration.type !== 'FunctionDeclaration') {
                context.report({
                    node: stmt,
                    message:
                        'Page files must default-export a function declaration.'
                })
                return
            }

            pageFn = stmt.declaration
            continue
        }

        context.report({
            node: stmt,
            message:
                'Page files may only contain imports, metadata, and the default page component.'
        })
        return
    }

    if (!metadata) {
        context.report({
            node,
            message: 'Page files must export metadata.'
        })
        return
    }

    if (!pageFn) {
        context.report({
            node,
            message: 'Page files must default-export a page function.'
        })
        return
    }

    if (
        pageFn.body.body.length !== 1 ||
        pageFn.body.body[0].type !== 'ReturnStatement'
    ) {
        context.report({
            node: pageFn,
            message: 'Page functions must return a single view component.'
        })
        return
    }

    const ret = pageFn.body.body[0]

    if (!ret.argument || ret.argument.type !== 'JSXElement') {
        context.report({
            node: ret,
            message: 'Page functions must return a single JSX view component.'
        })
        return
    }

    if (ret.argument.openingElement.name.type !== 'JSXIdentifier') {
        context.report({
            node: ret.argument,
            message: 'Page view must be a named component.'
        })
        return
    }

    if (viewNames.length === 0) {
        context.report({
            node,
            message: 'Page files must import a view from "@/views".'
        })
        return
    }

    if (viewNames.indexOf(ret.argument.openingElement.name.name) === -1) {
        context.report({
            node: ret.argument,
            message: 'Page must return the imported view component.'
        })
    }
}

const pageRule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Constrain page.tsx modules to metadata plus one view return.'
        }
    },
    create(context) {
        return {
            Program(node) {
                pageCheck(context, node)
            }
        }
    }
}

const plugin = {
    meta: {
        name: 'dora'
    },
    rules: {
        'function-only': functionRule,
        'type-prefix': typeRule,
        'identifier-words': nameRule,
        'import-order': orderRule,
        'page-module': pageRule
    }
}

export default plugin
