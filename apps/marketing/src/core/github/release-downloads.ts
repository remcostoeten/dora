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
            'One universal DMG for Apple Silicon and Intel Macs. Dora is not notarized: after the first launch, choose Open Anyway under System Settings, Privacy & Security.',
        downloads: [
            {
                label: 'Universal DMG',
                suffix: '.dmg'
            }
        ]
    },
    {
        title: 'Windows',
        description: 'Setup installers for x64 and ARM64 Windows 10 and 11.',
        downloads: [
            {
                label: 'Installer (x64)',
                suffix: '_x64-setup.exe'
            },
            {
                label: 'Installer (ARM64)',
                suffix: '_arm64-setup.exe'
            }
        ]
    },
    {
        title: 'Linux',
        description:
            'AppImage, Debian, RPM, Flatpak and archive packages for x86_64 and ARM64.',
        downloads: [
            {
                label: 'AppImage (x86_64)',
                suffix: '_amd64.AppImage'
            },
            {
                label: 'AppImage (ARM64)',
                suffix: '_aarch64.AppImage'
            },
            {
                label: 'Debian package (amd64)',
                suffix: '_amd64.deb'
            },
            {
                label: 'Debian package (arm64)',
                suffix: '_arm64.deb'
            },
            {
                label: 'RPM package (x86_64)',
                suffix: '.x86_64.rpm'
            },
            {
                label: 'RPM package (aarch64)',
                suffix: '.aarch64.rpm'
            },
            {
                label: 'Flatpak bundle (x86_64)',
                suffix: '-x86_64.flatpak'
            },
            {
                label: 'Linux archive (x86_64)',
                suffix: 'x86_64-unknown-linux-gnu.tar.gz'
            },
            {
                label: 'Snap Store',
                suffix: '.snap',
                fallbackHref: 'https://snapcraft.io/dora'
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
