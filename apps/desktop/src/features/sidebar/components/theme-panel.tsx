import { SidebarPanel } from "./sidebar-panel";
import { ThemePreviewCard } from "./theme-preview-card";

type Theme = 'dark' | 'light' | 'midnight' | 'forest' | 'claude' | 'claude-dark' | 'haptic'

type ThemeConfig = {
	value: Theme
	name: string
	variant: 'dark' | 'light'
	accentColor: string
}

const THEME_OPTIONS: ThemeConfig[] = [
	{ value: 'dark', name: 'Classic Dark', variant: 'dark', accentColor: '#e5e5e5' },
	{ value: 'light', name: 'Light', variant: 'light', accentColor: '#171717' },
	{ value: 'midnight', name: 'Midnight', variant: 'dark', accentColor: '#818cf8' },
	{ value: 'forest', name: 'Forest', variant: 'dark', accentColor: '#34d399' },
	{ value: 'claude', name: 'Claude Light', variant: 'light', accentColor: '#d97706' },
	{ value: 'claude-dark', name: 'Claude Dark', variant: 'dark', accentColor: '#b45309' },
	{ value: 'haptic', name: 'Haptic', variant: 'dark', accentColor: '#f5f5f5' }
]

type Props = {
	theme: Theme
	onThemeChange: (theme: Theme) => void
}

export function ThemePanel({ theme, onThemeChange }: Props) {
	return (
		<SidebarPanel>
			<div className='p-4 pt-5'>
				<div className='mb-4'>
					<h3 className='text-sm font-semibold text-sidebar-foreground'>
						Choose Your Theme
					</h3>
					<p className='text-xs text-muted-foreground mt-0.5'>
						Pick a style that suits your workflow
					</p>
				</div>

				<div className='grid grid-cols-2 gap-3 pb-2'>
					{THEME_OPTIONS.map((option) => (
						<ThemePreviewCard
							key={option.value}
							name={option.name}
							isSelected={theme === option.value}
							onClick={() => onThemeChange(option.value)}
							variant={option.variant}
							accentColor={option.accentColor}
						/>
					))}
				</div>
			</div>
		</SidebarPanel>
	)
}
