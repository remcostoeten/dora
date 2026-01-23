import { RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { Theme, FontPair, AppearanceSettings, getAppearanceSettings, saveAppearanceSettings, applyAppearanceToDOM, DEFAULT_SETTINGS } from "@/shared/lib/appearance-store";
import { loadFontPair } from "@/shared/lib/font-loader";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { cn } from "@/shared/utils/cn";
import { SidebarPanel } from "./sidebar-panel";
import { ThemePreviewCard } from "./theme-preview-card";

type ThemeConfig = {
	value: Theme
	name: string
	variant: 'dark' | 'light'
	accentColor: string
}

type FontConfig = {
	value: FontPair
	name: string
	description: string
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

const FONT_OPTIONS: FontConfig[] = [
	{ value: 'system', name: 'System', description: 'Inter + JetBrains Mono' },
	{ value: 'serif', name: 'Serif', description: 'Merriweather + Fira Code' },
	{ value: 'compact', name: 'Modern', description: 'IBM Plex Sans/Mono' },
	{ value: 'playful', name: 'Playful', description: 'Nunito + Source Code Pro' },
	{ value: 'technical', name: 'Technical', description: 'Roboto + Roboto Mono' },
	{ value: 'vintage', name: 'Vintage', description: 'Space Grotesk + Mono' }
]

export function AppearancePanel() {
	const [settings, setSettings] = useState<AppearanceSettings>(getAppearanceSettings)

	useEffect(function initializeAppearance() {
		applyAppearanceToDOM(settings)
	}, [])

	function handleThemeChange(theme: Theme) {
		const updated = saveAppearanceSettings({ theme })
		setSettings(updated)
		applyAppearanceToDOM(updated)
	}

	async function handleFontChange(fontPair: FontPair) {
		await loadFontPair(fontPair)
		const updated = saveAppearanceSettings({ fontPair })
		setSettings(updated)
		applyAppearanceToDOM(updated)
	}

	function handleReset() {
		const resetSettings = saveAppearanceSettings(DEFAULT_SETTINGS)
		setSettings(resetSettings)
		applyAppearanceToDOM(resetSettings)
	}

	function handleHueChange(hueShift: number) {
		const updated = saveAppearanceSettings({ hueShift })
		setSettings(updated)
		applyAppearanceToDOM(updated)
	}

	return (
		<SidebarPanel>
			<div className='p-4 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin'>
				{/* Theme Section */}
				<section>
					<h3 className='text-sm font-semibold text-sidebar-foreground mb-1'>Theme</h3>
					<p className='text-xs text-muted-foreground mb-3'>Choose your color scheme</p>
					<div className='grid grid-cols-3 gap-2'>
						{THEME_OPTIONS.map(function (option) {
							return (
								<ThemePreviewCard
									key={option.value}
									name={option.name}
									isSelected={settings.theme === option.value}
									onClick={function () {
										handleThemeChange(option.value)
									}}
									variant={option.variant}
									accentColor={option.accentColor}
								/>
							)
						})}
					</div>
				</section>

				{/* Hue Shift Section */}
				<section>
					<div className='flex items-center justify-between mb-3'>
						<div>
							<h3 className='text-sm font-semibold text-sidebar-foreground'>
								Color Shift
							</h3>
							<p className='text-xs text-muted-foreground mt-0.5'>
								Adjust the global hue
							</p>
						</div>
						<span className='text-xs font-mono text-muted-foreground bg-sidebar-accent px-2 py-1 rounded'>
							{settings.hueShift > 0 ? '+' : ''}
							{settings.hueShift}°
						</span>
					</div>
					<div className='px-1'>
						<Slider
							value={[settings.hueShift]}
							min={0}
							max={360}
							step={5}
							onValueChange={([val]) => handleHueChange(val)}
							className='w-full'
						/>
					</div>
				</section>

				{/* Font Section */}
				<section>
					<h3 className='text-sm font-semibold text-sidebar-foreground mb-1'>Font</h3>
					<p className='text-xs text-muted-foreground mb-3'>
						Select your preferred typography
					</p>
					<div className='grid grid-cols-2 gap-2'>
						{FONT_OPTIONS.map(function (option) {
							const isSelected = settings.fontPair === option.value
							return (
								<button
									key={option.value}
									onClick={function () {
										handleFontChange(option.value)
									}}
									className={cn(
										'flex flex-col items-start p-3 rounded-lg border transition-all text-left',
										isSelected
											? 'border-primary bg-primary/10 ring-1 ring-primary/30'
											: 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
									)}
								>
									<span className='text-sm font-medium text-foreground'>
										{option.name}
									</span>
									<span className='text-[10px] text-muted-foreground mt-0.5'>
										{option.description}
									</span>
								</button>
							)
						})}
					</div>
				</section>

				{/* Reset Section */}
				<div className='pt-4 border-t border-sidebar-border'>
					<Button
						variant='ghost'
						size='sm'
						onClick={handleReset}
						className='w-full text-muted-foreground hover:text-foreground'
					>
						<RotateCcw className='h-4 w-4 mr-2' />
						Reset to Defaults
					</Button>
				</div>
			</div>
		</SidebarPanel>
	)
}
