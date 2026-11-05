import { site } from './docs-site'

/**
 * @name repositoryFileUrl
 * @description The GitHub URL of a file in the Dora repository, relative to
 * the repository root.
 *
 * @example
 * repositoryFileUrl('docs/index.mdx') // "https://github.com/remcostoeten/dora/blob/master/docs/index.mdx"
 */
export function repositoryFileUrl(path: string) {
    return `${site.repository}/blob/${site.branch}/${path}`
}
