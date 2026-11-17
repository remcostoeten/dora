import { Check, RotateCcw } from 'lucide-react'
import { DEFAULT_SETTINGS, type FontPair, type Theme } from '@studio/shared/lib/appearance-store'
import { loadFontPair } from '@studio/shared/lib/font-loader'
import { Button } from '@studio/shared/ui/button'
import { Slider } from '@studio/shared/ui/slider'
import { cn } from '@studio/shared/utils/cn'
import { RadioGrid, SettingCard, SettingGroup, SettingRow } from '../components/setting-primitives'
import { useAppearanceSettings } from '../use-appearance'

type Hsl = [number, number, number]

type ThemeOption = {
	value: Theme
	name: string
	tinted: boolean
	background: Hsl
	sidebar: Hsl
	border: Hsl
	muted: Hsl
	foreground: Hsl
	primary: Hsl
}

type FontOption = {
	value: FontPair
	name: string
	pairing: string
	sans: string
	mono: string
}

const THEME_OPTIONS: ThemeOption[] = [
	{
		value: 'dark',
		name: 'Classic Dark',
		tinted: false,
		background: [0, 0, 6.7],
		sidebar: [0, 0, 6.7],
		border: [0, 0, 19],
		muted: [0, 0, 19],
		foreground: [0, 0, 95],
		primary: [0, 0, 98]
	},
	{
		value: 'light',
		name: 'Light',
		tinted: false,
		background: [0, 0, 100],
		sidebar: [0, 0, 98],
		border: [0, 0, 89.8],
		muted: [0, 0, 90],
		foreground: [0, 0, 3.9],
		primary: [0, 0, 9]
	},
	{
		value: 'midnight',
		name: 'Midnight',
		tinted: true,
		background: [226, 25, 10],
		sidebar: [226, 25, 9],
		border: [226, 25, 22],
		muted: [226, 25, 22],
		foreground: [226, 25, 98],
		primary: [244, 75, 65]
	},
	{
		value: 'forest',
		name: 'Forest',
		tinted: true,
		background: [150, 20, 8],
		sidebar: [150, 25, 7],
		border: [150, 20, 20],
		muted: [150, 20, 20],
		foreground: [150, 20, 95],
		primary: [142, 70, 50]
	},
	{
		value: 'bloom',
		name: 'Bloom',
		tinted: true,
		background: [280, 14, 8],
		sidebar: [280, 16, 7],
		border: [280, 14, 20],
		muted: [280, 14, 20],
		foreground: [300, 15, 96],
		primary: [353, 60, 78]
	},
	{
		value: 'claude',
		name: 'Claude Light',
		tinted: true,
		background: [32, 30, 96],
		sidebar: [32, 25, 94],
		border: [32, 18, 85],
		muted: [32, 20, 86],
		foreground: [25, 10, 15],
		primary: [25, 70, 50]
	},
	{
		value: 'claude-dark',
		name: 'Claude Dark',
		tinted: true,
		background: [30, 15, 12],
		sidebar: [30, 15, 10],
		border: [30, 15, 24],
		muted: [30, 15, 24],
		foreground: [30, 30, 96],
		primary: [25, 70, 50]
	},
	{
		value: 'night',
		name: 'Night',
		tinted: false,
		background: [0, 0, 0],
		sidebar: [0, 0, 0],
		border: [0, 0, 15],
		muted: [0, 0, 18],
		foreground: [0, 0, 93],
		primary: [0, 0, 98]
	}
]

const FONT_OPTIONS: FontOption[] = [
	{
		value: 'system',
		name: 'System',
		pairing: 'Inter + JetBrains Mono',
		sans: "'Inter', system-ui, sans-serif",
		mono: "'JetBrains Mono', monospace"
	},
	{
		value: 'serif',
		name: 'Serif',
		pairing: 'Merriweather + Fira Code',
		sans: "'Merriweather', Georgia, serif",
		mono: "'Fira Code', monospace"
	},
	{
		value: 'compact',
		name: 'Modern',
		pairing: 'IBM Plex Sans + Mono',
		sans: "'IBM Plex Sans', system-ui, sans-serif",
		mono: "'IBM Plex Mono', monospace"
	},
	{
		value: 'playful',
		name: 'Playful',
		pairing: 'Nunito + Source Code Pro',
		sans: "'Nunito', system-ui, sans-serif",
		mono: "'Source Code Pro', monospace"
	},
	{
		value: 'technical',
		name: 'Technical',
		pairing: 'Roboto + Roboto Mono',
		sans: "'Roboto', system-ui, sans-serif",
		mono: "'Roboto Mono', monospace"
	},
	{
		value: 'vintage',
		name: 'Vintage',
		pairing: 'Space Grotesk + Space Mono',
		sans: "'Space Grotesk', system-ui, sans-serif",
		mono: "'Space Mono', monospace"
	}
]

function hsl([h, s, l]: Hsl, shift: number, tinted: boolean, alpha?: number) {
	const hue = tinted && s > 0 ? (h + shift) % 360 : h
	return alpha === undefined ? `hsl(${hue} ${s}% ${l}%)` : `hsl(${hue} ${s}% ${l}% / ${alpha})`
}

function ThemeSwatch({ option, shift }: { option: ThemeOption; shift: number }) {
	const paint = (color: Hsl, alpha?: number) => hsl(color, shift, option.tinted, alpha)
	return (
		<span
			aria-hidden='true'
			className='grid aspect-[16/10] w-full grid-cols-[9%_27%_1fr] overflow-hidden rounded-md border'
			style={{ backgroundColor: paint(option.background), borderColor: paint(option.border) }}
		>
			<span
				className='flex flex-col items-center gap-1 border-r pt-1.5'
				style={{
					backgroundColor: paint(option.sidebar),
					borderColor: paint(option.border)
				}}
			>
				{[0, 1, 2].map((index) => (
					<i
						key={index}
						className='block aspect-square w-1/2 rounded-sm'
						style={{
							backgroundColor:
								index === 0 ? paint(option.foreground, 0.8) : paint(option.muted)
						}}
					/>
				))}
			</span>
			<span
				className='flex flex-col gap-[5px] border-r px-1.5 py-2'
				style={{
					backgroundColor: paint(option.sidebar),
					borderColor: paint(option.border)
				}}
			>
				{[80, 60, 70, 50].map((width, index) => (
					<i
						key={width}
						className='block h-1 rounded-sm'
						style={{
							width: `${width}%`,
							backgroundColor:
								index === 0 ? paint(option.foreground, 0.55) : paint(option.muted)
						}}
					/>
				))}
			</span>
			<span className='flex min-w-0 flex-col gap-[5px] p-2'>
				<span className='mb-[3px] flex items-center gap-1'>
					<i
						className='block h-1.5 w-1/3 rounded-full'
						style={{ backgroundColor: paint(option.primary) }}
					/>
					<i
						className='block h-1.5 w-1/6 rounded-full'
						style={{ backgroundColor: paint(option.muted) }}
					/>
				</span>
				{[80, 100, 80, 100].map((width, index) => (
					<i
						key={index}
						className='block h-[3px] rounded-sm'
						style={{
							width: `${width}%`,
							backgroundColor: paint(option.foreground, 0.16)
						}}
					/>
				))}
			</span>
		</span>
	)
}

export function AppearanceScreen() {
	const { settings, update } = useAppearanceSettings()
	const current = THEME_OPTIONS.find((option) => option.value === settings.theme)
	const isDefault =
		settings.theme === DEFAULT_SETTINGS.theme &&
		settings.fontPair === DEFAULT_SETTINGS.fontPair &&
		settings.hueShift === DEFAULT_SETTINGS.hueShift

	async function changeFont(fontPair: FontPair) {
		await loadFontPair(fontPair)
		update({ fontPair })
	}

	async function resetAppearance() {
		await loadFontPair(DEFAULT_SETTINGS.fontPair)
		update(DEFAULT_SETTINGS)
	}

	function shiftHelp() {
		if (!current) return 'Rotates the hue of tinted themes.'
		if (!current.tinted) {
			return `${current.name} is neutral. The shift shows on Midnight, Forest, Bloom and both Claude themes.`
		}
		return settings.hueShift
			? `Rotates every tint of ${current.name} by ${settings.hueShift}°.`
			: `Rotates every tint of ${current.name}.`
	}

	return (
		<>
			<SettingGroup label='Color'>
				<SettingCard>
					<SettingRow
						focusId='appearance-theme'
						label='Theme'
						labelId='appearance-theme-label'
						help='Applies to the whole app, including the editor and data grid.'
						stacked
					>
						<RadioGrid
							label='Theme'
							className='grid w-full grid-cols-2 gap-2 @[560px]:grid-cols-4'
						>
							{THEME_OPTIONS.map((option) => {
								const checked = settings.theme === option.value
								return (
									<button
										key={option.value}
										type='button'
										role='radio'
										aria-checked={checked}
										aria-label={option.name}
										tabIndex={checked ? 0 : -1}
										onClick={() => update({ theme: option.value })}
										className={cn(
											'flex flex-col gap-1.5 rounded-lg p-1.5 pb-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100',
											checked
												? 'bg-accent focus-visible:bg-focus-strong'
												: 'hover:bg-focus focus-visible:bg-focus-strong'
										)}
									>
										<ThemeSwatch option={option} shift={settings.hueShift} />
										<span className='flex items-center justify-between gap-1.5 px-0.5 text-xs text-foreground'>
											{option.name}
											<span
												className={cn(
													'grid h-[15px] w-[15px] place-items-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] duration-150',
													checked
														? 'scale-100 opacity-100'
														: 'scale-60 opacity-0'
												)}
											>
												<Check className='h-2.5 w-2.5' strokeWidth={3} />
											</span>
										</span>
									</button>
								)
							})}
						</RadioGrid>
					</SettingRow>

					<SettingRow
						focusId='appearance-color-shift'
						label='Color shift'
						labelId='appearance-shift-label'
						help={shiftHelp()}
					>
						<Slider
							aria-labelledby='appearance-shift-label'
							className='w-48'
							value={[settings.hueShift]}
							min={0}
							max={360}
							step={1}
							onValueChange={([hueShift]) => update({ hueShift })}
						/>
						<output className='min-w-11 text-right font-mono text-xs tabular-nums text-foreground'>
							{settings.hueShift}°
						</output>
						<Button
							variant='ghost'
							size='sm'
							disabled={settings.hueShift === 0}
							onClick={() => update({ hueShift: 0 })}
							className='h-7 text-xs text-muted-foreground hover:text-foreground'
						>
							Reset
						</Button>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Typography'>
				<SettingCard>
					<SettingRow
						focusId='appearance-typography'
						label='App typography'
						labelId='appearance-typography-label'
						help='Font pairing for the interface and for code.'
						stacked
					>
						<RadioGrid
							label='App typography'
							className='grid w-full grid-cols-2 gap-2 @[560px]:grid-cols-3'
						>
							{FONT_OPTIONS.map((option) => {
								const checked = settings.fontPair === option.value
								return (
									<button
										key={option.value}
										type='button'
										role='radio'
										aria-checked={checked}
										tabIndex={checked ? 0 : -1}
										onClick={() => void changeFont(option.value)}
										className={cn(
											'flex min-w-0 flex-col items-start gap-0.5 rounded-lg p-3 text-left transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100',
											checked
												? 'bg-accent focus-visible:bg-focus-strong'
												: 'bg-foreground/[0.04] hover:bg-focus focus-visible:bg-focus-strong'
										)}
									>
										<span
											className='mb-2 flex w-full items-center justify-between text-2xl font-semibold leading-none text-foreground'
											style={{ fontFamily: option.sans }}
										>
											Ag
											<span
												className={cn(
													'grid h-[15px] w-[15px] place-items-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] duration-150',
													checked
														? 'scale-100 opacity-100'
														: 'scale-60 opacity-0'
												)}
											>
												<Check className='h-2.5 w-2.5' strokeWidth={3} />
											</span>
										</span>
										<span
											className='text-xs font-semibold text-foreground'
											style={{ fontFamily: option.sans }}
										>
											{option.name}
										</span>
										<span className='text-[11px] text-muted-foreground'>
											{option.pairing}
										</span>
										<span
											className='mt-1.5 max-w-full truncate text-[11px] text-muted-foreground'
											style={{ fontFamily: option.mono }}
										>
											SELECT * FROM orders;
										</span>
									</button>
								)
							})}
						</RadioGrid>
					</SettingRow>
				</SettingCard>
			</SettingGroup>

			<div className='mt-5 flex justify-end'>
				<Button
					variant='ghost'
					size='sm'
					disabled={isDefault}
					onClick={() => void resetAppearance()}
					className='h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground'
				>
					<RotateCcw className='h-3.5 w-3.5' />
					Reset to defaults
				</Button>
			</div>
		</>
	)
}
