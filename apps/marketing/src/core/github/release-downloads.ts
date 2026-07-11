export type TAsset = {
    name: string
    browser_download_url: string
}

export type TDownload = {
    label: string
    suffix: string
    archPattern?: RegExp
    fallbackHref?: string
}

export type TGroup = {
    title: string
    description: string
    downloads: TDownload[]
}

export type TLatest = {
    tagName: string
    htmlUrl: string
    assets: TAsset[]
}

const REPO_OWNER = 'remcostoeten'
const REPO_NAME = 'dora'
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`

export const RELEASE_GROUPS: TGroup[] = [
    {
        title: 'macOS',
        description:
            'Download signed DMG installers for Apple Silicon and Intel Macs.',
        downloads: [
            {
                label: 'Apple Silicon DMG',
                suffix: '.dmg',
                archPattern: /(?:aarch64|arm64)/i
            },
            {
                label: 'Intel DMG',
                suffix: '.dmg',
                archPattern: /(?:x64|x86_64|amd64)/i
            }
        ]
    },
    {
        title: 'Windows',
        description:
            'Install Dora with the Windows setup executable or MSI package.',
        downloads: [
            {
                label: 'Windows EXE',
                suffix: '.exe'
            },
            {
                label: 'Windows MSI',
                suffix: '.msi'
            }
        ]
    },
    {
        title: 'Linux',
        description:
            'Use AppImage, Debian, RPM, Snap, or archive packages from GitHub Releases.',
        downloads: [
            {
                label: 'AppImage',
                suffix: '.AppImage'
            },
            {
                label: 'Debian package',
                suffix: '.deb'
            },
            {
                label: 'RPM package',
                suffix: '.rpm'
            },
            {
                label: 'Snap package',
                suffix: '.snap',
                fallbackHref: LATEST_RELEASE_URL
            },
            {
                label: 'Linux archive',
                suffix: '.tar.gz'
            }
        ]
    }
]

function matchesDownload(asset: TAsset, download: TDownload): boolean {
    if (!asset.name.endsWith(download.suffix)) {
        return false
    }

    if (!download.archPattern) {
        return true
    }

    return download.archPattern.test(asset.name)
}

export function findAsset(
    assets: TAsset[],
    download: TDownload
): TAsset | undefined {
    for (const asset of assets) {
        if (matchesDownload(asset, download)) {
            return asset
        }
    }

    return undefined
}

export function getHref(
    asset: TAsset | undefined,
    download: TDownload,
    releaseUrl: string
): string {
    if (asset) {
        return asset.browser_download_url
    }

    if (download.fallbackHref) {
        return download.fallbackHref
    }

    return releaseUrl
}

export function getLead(release: TLatest | null): string {
    if (release) {
        return `Latest GitHub release: ${release.tagName}.`
    }

    return 'Download the latest Dora installers from GitHub Releases.'
}
