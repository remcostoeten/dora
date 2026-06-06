import {
    findAsset,
    getHref,
    getLead,
    getRelease,
    LATEST_RELEASE_URL,
    RELEASE_GROUPS,
    type TAsset,
    type TDownload,
    type TGroup
} from '@/core/github/release-downloads'

function renderDownload(
    download: TDownload,
    assets: TAsset[],
    releaseUrl: string
) {
    const asset = findAsset(assets, download)

    return (
        <a
            className="button secondary"
            href={getHref(asset, download, releaseUrl)}
            key={download.label}
            rel="noreferrer"
            target="_blank"
        >
            {download.label}
        </a>
    )
}

function renderDownloads(group: TGroup, assets: TAsset[], releaseUrl: string) {
    const downloads = []

    for (const download of group.downloads) {
        downloads.push(renderDownload(download, assets, releaseUrl))
    }

    return downloads
}

function renderGroup(group: TGroup, assets: TAsset[], releaseUrl: string) {
    return (
        <article className="tile" key={group.title}>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <div className="actions">
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
        <main className="content-page">
            <p className="eyebrow">Downloads</p>
            <h1>Download Dora</h1>
            <p className="lead">{getLead(latestRelease)}</p>
            <section aria-label="Download targets" className="section-grid">
                {renderGroups(assets, releaseUrl)}
            </section>
        </main>
    )
}
