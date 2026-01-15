export const siteConfig = {
    name: "Dora",
    description: "A modern database studio for SQLite and PostgreSQL",
    author: "Remco Stoeten",
    
    github: {
        owner: "remcostoeten",
        repo: "dora",
        url: "https://github.com/remcostoeten/dora",
        releasesUrl: "https://github.com/remcostoeten/dora/releases",
        apiUrl: "https://api.github.com/repos/remcostoeten/dora/releases/latest",
    },

    links: {
        github: "https://github.com/remcostoeten/dora",
        releases: "https://github.com/remcostoeten/dora/releases",
        issues: "https://github.com/remcostoeten/dora/issues",
    },
} as const;

export type SiteConfig = typeof siteConfig;
