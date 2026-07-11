import { cacheLife, cacheTag } from 'next/cache'

import {
    LATEST_RELEASE_URL,
    type TAsset,
    type TLatest
} from './release-downloads'

type TApiRelease = {
    tag_name?: string
    html_url?: string
    assets?: TAsset[]
}

const REPO_OWNER = 'remcostoeten'
const REPO_NAME = 'dora'

function getHeaders(): HeadersInit {
    const headers: HeadersInit = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'dora-marketing'
    }
    const token = process.env.GITHUB_TOKEN

    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    return headers
}

function normalizeRelease(release: TApiRelease): TLatest {
    return {
        tagName: release.tag_name ?? 'latest',
        htmlUrl: release.html_url ?? LATEST_RELEASE_URL,
        assets: release.assets ?? []
    }
}

export async function getRelease(): Promise<TLatest | null> {
    'use cache'
    cacheTag('github-release')
    cacheLife('hours')

    try {
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
            { headers: getHeaders() }
        )

        if (!response.ok) {
            return null
        }

        return normalizeRelease((await response.json()) as TApiRelease)
    } catch {
        return null
    }
}
