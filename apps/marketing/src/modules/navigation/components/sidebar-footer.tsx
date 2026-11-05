import { GitHubIcon } from '@/shared/components/github-icon'

type Props = { repositoryUrl?: string }

export function SidebarFooter({ repositoryUrl }: Props) {
    if (!repositoryUrl) return null

    return (
        <div className="flex items-center gap-1 border-t border-foreground/5 p-2 text-foreground/40">
            <a
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex size-8 items-center justify-center pressable hover:bg-foreground/5 hover:text-foreground/70 focus-visible:bg-foreground/8 focus-visible:text-foreground"
                aria-label="GitHub"
            >
                <GitHubIcon className="size-4" />
            </a>
        </div>
    )
}
