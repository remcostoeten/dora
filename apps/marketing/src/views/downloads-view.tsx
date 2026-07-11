import { TrackedDownloadLink } from '@/components/tracked-download-link'
import { ResourcesPageShell } from '@/components/resources-page-shell'
import {
    findAsset,
    getHref,
    getLead,
    LATEST_RELEASE_URL,
    RELEASE_GROUPS,
    type TAsset,
    type TDownload,
    type TGroup
} from '@/core/github/release-downloads'
import { getRelease } from '@/core/github/get-release'

const DOWNLOAD_LINK_CLASS =
    'inline-flex min-h-9 items-center justify-center border border-line-strong px-3.5 text-[13px] text-foreground transition-colors hover:border-brand-600/50 hover:bg-brand-600/6'

function renderDownload(
    download: TDownload,
    assets: TAsset[],
    releaseUrl: string,
    platform: string
) {
    const asset = findAsset(assets, download)

    return (
        <TrackedDownloadLink
            className={DOWNLOAD_LINK_CLASS}
            href={getHref(asset, download, releaseUrl)}
            key={download.label}
            label={download.label}
            platform={platform}
        />
    )
}

function renderDownloads(group: TGroup, assets: TAsset[], releaseUrl: string) {
    const downloads = []

    for (const download of group.downloads) {
        downloads.push(
            renderDownload(download, assets, releaseUrl, group.title)
        )
    }

    return downloads
}

function renderGroup(group: TGroup, assets: TAsset[], releaseUrl: string) {
    return (
        <article
            className="flex min-h-[160px] flex-col border border-line bg-background/40 p-5"
            key={group.title}
        >
            <h2 className="font-pixel text-lg font-medium text-foreground">
                {group.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {group.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
                {renderDownloads(group, assets, releaseUrl)}
            </div>
        </article>
    )
}

function renderGroups(assets: TAsset[], releaseUrl: string) {
    const groups = []

    for (const group of RELEASE_GROUPS) {
        groups.push(renderGroup(group, assets, releaseUrl))
    }

    return groups
}

export default async function DownloadsView() {
    const latestRelease = await getRelease()
    const assets = latestRelease ? latestRelease.assets : []
    const releaseUrl = latestRelease
        ? latestRelease.htmlUrl
        : LATEST_RELEASE_URL

    return (
        <ResourcesPageShell
            eyebrow="Downloads"
            title="Download Dora"
            lead={getLead(latestRelease)}
        >
            <section
                aria-label="Download targets"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
                {renderGroups(assets, releaseUrl)}
            </section>
        </ResourcesPageShell>
    )
}
