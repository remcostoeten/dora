import { useQuery } from "@tanstack/react-query";
import { siteConfig } from "@/config/site";

type ReleaseAsset = {
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
    content_type: string;
};

type GitHubRelease = {
    tag_name: string;
    name: string;
    published_at: string;
    html_url: string;
    body: string;
    assets: ReleaseAsset[];
};

type ParsedRelease = {
    version: string;
    name: string;
    publishedAt: Date;
    releaseUrl: string;
    releaseNotes: string;
    downloads: {
        mac?: string;
        linux?: string;
        linuxDeb?: string;
        linuxRpm?: string;
        windows?: string;
    };
    totalDownloads: number;
};

function parseRelease(release: GitHubRelease): ParsedRelease {
    const downloads: ParsedRelease["downloads"] = {};
    let totalDownloads = 0;

    for (const asset of release.assets) {
        totalDownloads += asset.download_count;
        const name = asset.name.toLowerCase();

        if (name.endsWith(".dmg") || name.endsWith(".app.zip")) {
            downloads.mac = asset.browser_download_url;
        } else if (name.endsWith(".appimage")) {
            downloads.linux = asset.browser_download_url;
        } else if (name.endsWith(".deb")) {
            downloads.linuxDeb = asset.browser_download_url;
        } else if (name.endsWith(".rpm")) {
            downloads.linuxRpm = asset.browser_download_url;
        } else if (name.endsWith(".exe") || name.endsWith(".msi")) {
            downloads.windows = asset.browser_download_url;
        }
    }

    return {
        version: release.tag_name.replace(/^v/, ""),
        name: release.name,
        publishedAt: new Date(release.published_at),
        releaseUrl: release.html_url,
        releaseNotes: release.body,
        downloads,
        totalDownloads,
    };
}

async function fetchLatestRelease(): Promise<ParsedRelease | null> {
    const response = await fetch(siteConfig.github.apiUrl, {
        headers: {
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        throw new Error(`Failed to fetch release: ${response.statusText}`);
    }

    const release: GitHubRelease = await response.json();
    return parseRelease(release);
}

export function useGitHubRelease() {
    return useQuery({
        queryKey: ["github-release", siteConfig.github.owner, siteConfig.github.repo],
        queryFn: fetchLatestRelease,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export type { ParsedRelease, ReleaseAsset };
