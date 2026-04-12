import { Github, ExternalLink, Globe } from 'lucide-react'
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from './sidebar-panel'
import { siteConfig } from '@/config/site'

type Props = {
	className?: string
	maxHeight?: number
}

export function ProjectInfoPanel({ className, maxHeight = 400 }: Props) {
	return (
		<SidebarPanel className={className}>
			<SidebarPanelHeader title='Project Info' />
			<SidebarPanelContent maxHeight={maxHeight}>
				<div className='p-2 space-y-4'>
					<div className='space-y-1'>
						<div className='flex flex-col gap-1'>
							<a
								href={siteConfig.links.github}
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<Github className='h-4 w-4 opacity-70 group-hover:opacity-100' />
								<span>Repository</span>
								<ExternalLink className='h-3 w-3 ml-auto opacity-0 group-hover:opacity-50' />
							</a>

							<a
								href={siteConfig.links.releases}
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<ExternalLink className='h-4 w-4 opacity-70 group-hover:opacity-100' />
								<span>Releases</span>
								<ExternalLink className='h-3 w-3 ml-auto opacity-0 group-hover:opacity-50' />
							</a>

							<a
								href={siteConfig.links.website}
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<Globe className='h-4 w-4 opacity-70 group-hover:opacity-100' />
								<span>Website</span>
								<ExternalLink className='h-3 w-3 ml-auto opacity-0 group-hover:opacity-50' />
							</a>
						</div>
					</div>

				</div>
			</SidebarPanelContent>
		</SidebarPanel>
	)
}
