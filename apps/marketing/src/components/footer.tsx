import Link from "next/link";

import { FooterFrame } from "@/components/footer-frame";
import { getGitHubStats } from "@/core/github/get-github-stats";
import { siteConfig } from "@/core/config/site";

const FOOTER_LINKS = [
  {
    label: "GitHub Profile",
    href: "https://github.com/remcostoeten",
    external: true,
  },
  {
    label: "Repository",
    href: "https://github.com/remcostoeten/dora",
    external: true,
  },
  { label: "Features", href: "/features", external: false },
  { label: "Docs", href: "/docs", external: false },
  { label: "Changelog", href: "/changelog", external: false },
] as const;

function FooterLink({ href, label, external }: (typeof FOOTER_LINKS)[number]) {
  const className =
    "border-0 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground";

  if (external) {
    return (
      <a className={className} href={href} rel="noreferrer" target="_blank">
        {label}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {label}
    </Link>
  );
}

function renderLink(link: (typeof FOOTER_LINKS)[number]) {
  return <FooterLink key={link.label} {...link} />;
}

function truncateCommitMessage(message: string, maxLength = 72): string {
  const trimmed = message.trim();
  if (!trimmed) return "Updated the repo";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatCommitAge(dateTime: string): string {
  if (!dateTime) return "recently";

  const commitDate = new Date(dateTime);
  if (Number.isNaN(commitDate.getTime())) return "recently";

  const diffMs = Date.now() - commitDate.getTime();
  if (diffMs < 0) return "just now";

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return commitDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function Footer() {
  const year = new Date().getFullYear();
  const stats = await getGitHubStats();
  const latestCommitLine = stats
    ? `Latest commit: ${truncateCommitMessage(stats.latestCommitMessage)} · ${formatCommitAge(stats.latestCommitDateTime)} · ${stats.latestCommitSha}`
    : null;
  const latestCommitUrl = stats?.latestCommitSha
    ? `https://github.com/remcostoeten/dora/commit/${stats.latestCommitSha}`
    : null;

  return (
    <section className="marketing-container marketing-footer relative">
      <FooterFrame />
      <footer className="flex flex-col gap-6 px-5 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Engineered by{" "}
            <Link
              href={siteConfig.author.url}
              target="_blank"
              rel="noreferrer"
              className="border-b border-border text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground"
            >
              {siteConfig.author.name}
            </Link>
          </span>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            {FOOTER_LINKS.map(renderLink)}
          </nav>
        </div>

        <div className="flex flex-col gap-1 border-t border-line-strong/40 pt-4 text-xs leading-relaxed text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span>&copy; {year} Dora. All rights reserved.</span>
          {latestCommitLine ? (
            latestCommitUrl ? (
              <a
                href={latestCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="border-0 outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground"
                title={
                  stats?.latestCommitDateTime
                    ? new Date(stats.latestCommitDateTime).toLocaleString(
                        "en-US",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )
                    : undefined
                }
              >
                {latestCommitLine}
              </a>
            ) : (
              <span
                title={
                  stats?.latestCommitDateTime
                    ? new Date(stats.latestCommitDateTime).toLocaleString(
                        "en-US",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )
                    : undefined
                }
              >
                {latestCommitLine}
              </span>
            )
          ) : null}
        </div>
      </footer>
    </section>
  );
}
