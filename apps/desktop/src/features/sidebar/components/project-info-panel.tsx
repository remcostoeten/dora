import { Github, User, Download, ExternalLink, Globe, Heart } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { CURRENT_VERSION } from "../changelog-data";
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent, SidebarSection } from "./sidebar-panel";

type Props = {
	maxHeight?: number
}

export function ProjectInfoPanel({ maxHeight = 400 }: Props) {
	return (
		<SidebarPanel>
			<SidebarPanelHeader title='Project Info' version={CURRENT_VERSION} />

			<SidebarPanelContent maxHeight={maxHeight}>
				<div className='p-4'>
					<SidebarSection title='About'>
						<p className='text-sm text-sidebar-foreground leading-relaxed'>
							Dora is a modern database management tool designed for developer
							happiness. Built with Tauri, React, and Rust.
						</p>
					</SidebarSection>

					<SidebarSection title='Links'>
						<div className='grid gap-2'>
							<a
								href='https://github.com/remco-stoeten/dora'
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<div className='p-1.5 bg-sidebar-accent rounded-md group-hover:bg-background transition-colors'>
									<Github className='h-4 w-4' />
								</div>
								<div className='flex-1'>
									<div className='font-medium'>Repository</div>
									<div className='text-xs text-muted-foreground'>
										Source code & Issues
									</div>
								</div>
								<ExternalLink className='h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
							</a>

							<a
								href='https://github.com/remco-stoeten/dora/releases'
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<div className='p-1.5 bg-sidebar-accent rounded-md group-hover:bg-background transition-colors'>
									<Download className='h-4 w-4' />
								</div>
								<div className='flex-1'>
									<div className='font-medium'>Downloads</div>
									<div className='text-xs text-muted-foreground'>
										Latest releases
									</div>
								</div>
								<ExternalLink className='h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
							</a>

							<a
								href='https://remcostoeten.com'
								target='_blank'
								rel='noopener noreferrer'
								className='flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group'
							>
								<div className='p-1.5 bg-sidebar-accent rounded-md group-hover:bg-background transition-colors'>
									<Globe className='h-4 w-4' />
								</div>
								<div className='flex-1'>
									<div className='font-medium'>Website</div>
									<div className='text-xs text-muted-foreground'>
										remcostoeten.com
									</div>
								</div>
								<ExternalLink className='h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
							</a>
						</div>
					</SidebarSection>

					<SidebarSection title='Author' separator={false}>
						<div className='flex items-center gap-3 p-2 rounded-md bg-sidebar-accent/30 border border-sidebar-border/50'>
							<div className='h-10 w-10 rounded-full bg-sidebar-accent flex items-center justify-center border border-sidebar-border'>
								<User className='h-5 w-5 text-muted-foreground' />
							</div>
							<div>
								<div className='text-sm font-medium'>Remco Stoeten</div>
								<div className='text-xs text-muted-foreground flex items-center gap-1'>
									Made with{' '}
									<Heart className='h-3 w-3 text-red-500 fill-red-500 inline' />{' '}
									in The Netherlands
								</div>
							</div>
						</div>
					</SidebarSection>
				</div>
			</SidebarPanelContent>
		</SidebarPanel>
	)
}
