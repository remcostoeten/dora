interface GitHubCommit {
    sha: string
    commit: {
        message: string
        author: {
            name: string
            date: string
        }
    }
    author: {
        login: string
        avatar_url: string
    } | null
}

interface GitHubRelease {
    tag_name: string
    published_at: string
    html_url: string
    body?: string
    assets: Array<{
        name: string
        download_count: number
        browser_download_url: string
    }>
}

interface GitHubRepo {
    stargazers_count: number
    created_at: string
    description: string
    language: string
}

interface GitHubContributor {
    contributions: number
}

export interface CommitData {
    date: string
    commits: number
    details: Array<{
        sha: string
        message: string
        author: string
        authorAvatar?: string
        time: string
    }>
}

export interface PackageInfo {
    name: string
    platform: 'snap' | 'github' | 'brew' | 'aur' | 'apt' | 'winget'
    command?: string
    version?: string
    downloads?: number
    url: string
}

export interface GitHubStatsData {
    version: string
    versionUrl: string
    startedAt: string
    latestCommitAt: string
    latestCommitSha: string
    totalCommits: number
    stars: number
    description: string
    language: string
    commitData: CommitData[]
    packages: PackageInfo[]
    releaseNotes?: string
}

const REPO_OWNER = 'remcostoeten'
const REPO_NAME = 'dora'

/**
 * Fetches and shapes the GitHub stats rendered in the marketing stats panel.
 * Runs on the server so the data lands in the initial HTML (SEO + no client
 * waterfall). The per-`fetch` `revalidate` windows make the consuming page ISR:
 * served statically from cache, refreshed in the background. Returns `null` on
 * failure so the page can omit the section gracefully rather than error.
 */
export async function getGitHubStats(): Promise<GitHubStatsData | null> {
    try {
        const headers: HeadersInit = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'dora-marketing'
        }

        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
        }

        // Fetch all data in parallel
        const [repoRes, releasesRes, commitsRes, contributorsRes] =
            await Promise.all([
                fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
                    {
                        headers,
                        next: { revalidate: 3600 }
                    }
                ),
                fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=10`,
                    {
                        headers,
                        next: { revalidate: 3600 }
                    }
                ),
                fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=100`,
                    {
                        headers,
                        next: { revalidate: 300 }
                    }
                ),
                fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100&anon=true`,
                    {
                        headers,
                        next: { revalidate: 3600 }
                    }
                )
            ])

        if (!repoRes.ok || !commitsRes.ok) {
            throw new Error('Failed to fetch GitHub data')
        }

        const repo: GitHubRepo = await repoRes.json()
        const releases: GitHubRelease[] = releasesRes.ok
            ? await releasesRes.json()
            : []
        const allCommits: GitHubCommit[] = await commitsRes.json()

        // Calculate total commits from all contributors
        let totalCommits = 0
        if (contributorsRes.ok) {
            const contributors: GitHubContributor[] =
                await contributorsRes.json()
            totalCommits = contributors.reduce(
                (sum, c) => sum + c.contributions,
                0
            )
        } else {
            totalCommits = allCommits.length
        }

        // Calculate total downloads from all GitHub releases
        let totalGitHubDownloads = 0
        for (const release of releases) {
            for (const asset of release.assets) {
                totalGitHubDownloads += asset.download_count
            }
        }

        // Build packages array with all available platforms from GitHub Actions workflows
        const packages: PackageInfo[] = [
            // Homebrew (macOS/Linux)
            {
                name: 'Homebrew',
                platform: 'brew',
                command: 'brew install remcostoeten/tap/dora',
                url: 'https://github.com/remcostoeten/homebrew-tap'
            },
            // Snap Store (Linux)
            {
                name: 'Snap',
                platform: 'snap',
                command: 'snap install dora',
                url: 'https://snapcraft.io/dora'
            },
            // AUR (Arch Linux)
            {
                name: 'AUR',
                platform: 'aur',
                command: 'yay -S dora-bin',
                url: 'https://aur.archlinux.org/packages/dora-bin'
            },
            // APT (Debian/Ubuntu)
            {
                name: 'APT',
                platform: 'apt',
                command: 'apt install dora',
                url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
            },
            // Winget (Windows)
            {
                name: 'Winget',
                platform: 'winget',
                command: 'winget install remcostoeten.dora',
                url: 'https://github.com/microsoft/winget-pkgs'
            },
            // GitHub Releases (all platforms)
            {
                name: 'GitHub',
                platform: 'github',
                version: releases[0]?.tag_name,
                downloads: totalGitHubDownloads,
                url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
            }
        ]

        // Fetch additional commit pages for 90-day graph
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

        let moreCommits: GitHubCommit[] = []
        const oldestFetched =
            allCommits.length > 0
                ? new Date(allCommits[allCommits.length - 1].commit.author.date)
                : new Date()

        if (oldestFetched > ninetyDaysAgo) {
            let page = 2
            while (page <= 4) {
                const moreRes = await fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=100&page=${page}`,
                    { headers, next: { revalidate: 300 } }
                )
                if (!moreRes.ok) break
                const pageCommits: GitHubCommit[] = await moreRes.json()
                if (pageCommits.length === 0) break
                moreCommits = [...moreCommits, ...pageCommits]

                const oldest = new Date(
                    pageCommits[pageCommits.length - 1].commit.author.date
                )
                if (oldest <= ninetyDaysAgo) break
                page++
            }
        }

        const combinedCommits = [...allCommits, ...moreCommits]

        // Group commits by date for last 90 days
        const commitsByDate = new Map<string, CommitData>()

        for (let i = 89; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
            commitsByDate.set(dateStr, {
                date: dateStr,
                commits: 0,
                details: []
            })
        }

        for (const commit of combinedCommits) {
            const commitDate = new Date(commit.commit.author.date)
            const dateStr = commitDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })

            const existing = commitsByDate.get(dateStr)
            if (existing) {
                existing.commits++
                existing.details.push({
                    sha: commit.sha.slice(0, 7),
                    message: commit.commit.message.split('\n')[0],
                    author: commit.author?.login || commit.commit.author.name,
                    authorAvatar: commit.author?.avatar_url,
                    time: commitDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    })
                })
            }
        }

        const latestRelease = releases[0]
        const version = latestRelease?.tag_name || 'v0.0.0'
        const versionUrl =
            latestRelease?.html_url ||
            `https://github.com/${REPO_OWNER}/${REPO_NAME}`

        const latestCommitDate = allCommits[0]
            ? new Date(allCommits[0].commit.author.date).toLocaleDateString(
                  'en-US',
                  {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                  }
              )
            : 'Unknown'

        const latestCommitSha = allCommits[0]?.sha.slice(0, 7) || ''

        const startedAt = new Date(repo.created_at).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        })

        return {
            version,
            versionUrl,
            startedAt,
            latestCommitAt: latestCommitDate,
            latestCommitSha,
            totalCommits,
            stars: repo.stargazers_count,
            description: repo.description,
            language: repo.language,
            commitData: Array.from(commitsByDate.values()),
            packages,
            releaseNotes: latestRelease?.body?.slice(0, 500)
        }
    } catch (error) {
        console.error('GitHub stats error:', error)
        return null
    }
}
