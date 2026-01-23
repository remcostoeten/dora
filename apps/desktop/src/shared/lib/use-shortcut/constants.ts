export const Platform = {
	MAC: 'mac',
	WINDOWS: 'windows',
	LINUX: 'linux'
} as const

export type PlatformType = (typeof Platform)[keyof typeof Platform]

export function detectPlatform(): PlatformType {
	if (typeof navigator === 'undefined') return Platform.WINDOWS
	const platform = navigator.platform.toLowerCase()
	if (platform.includes('mac')) return Platform.MAC
	if (platform.includes('linux')) return Platform.LINUX
	return Platform.WINDOWS
}

export const ModifierKey = {
	META: 'meta',
	CTRL: 'ctrl',
	ALT: 'alt',
	SHIFT: 'shift'
} as const

export type ModifierKeyType = (typeof ModifierKey)[keyof typeof ModifierKey]

export const ModifierAliases: Record<string, ModifierKeyType> = {
	command: ModifierKey.META,
	cmd: ModifierKey.META,
	'⌘': ModifierKey.META,
	meta: ModifierKey.META,
	win: ModifierKey.META,
	windows: ModifierKey.META,
	super: ModifierKey.META,
	mod: ModifierKey.META,
	control: ModifierKey.CTRL,
	ctrl: ModifierKey.CTRL,
	'⌃': ModifierKey.CTRL,
	ctl: ModifierKey.CTRL,
	alt: ModifierKey.ALT,
	option: ModifierKey.ALT,
	opt: ModifierKey.ALT,
	'⌥': ModifierKey.ALT,
	shift: ModifierKey.SHIFT,
	'⇧': ModifierKey.SHIFT,
	shft: ModifierKey.SHIFT
} as const

export const SpecialKeyMap: Record<string, string> = {
	up: 'ArrowUp',
	down: 'ArrowDown',
	left: 'ArrowLeft',
	right: 'ArrowRight',
	home: 'Home',
	end: 'End',
	pageup: 'PageUp',
	pagedown: 'PageDown',
	enter: 'Enter',
	return: 'Enter',
	space: ' ',
	spacebar: ' ',
	tab: 'Tab',
	backspace: 'Backspace',
	delete: 'Delete',
	del: 'Delete',
	escape: 'Escape',
	esc: 'Escape',
	f1: 'F1',
	f2: 'F2',
	f3: 'F3',
	f4: 'F4',
	f5: 'F5',
	f6: 'F6',
	f7: 'F7',
	f8: 'F8',
	f9: 'F9',
	f10: 'F10',
	f11: 'F11',
	f12: 'F12',
	plus: '+',
	minus: '-',
	comma: ',',
	period: '.',
	slash: '/',
	backslash: '\\',
	bracket: '[',
	closebracket: ']'
} as const

export const ModifierDisplaySymbols: Record<PlatformType, Record<ModifierKeyType, string>> = {
	[Platform.MAC]: {
		[ModifierKey.META]: '⌘',
		[ModifierKey.CTRL]: '⌃',
		[ModifierKey.ALT]: '⌥',
		[ModifierKey.SHIFT]: '⇧'
	},
	[Platform.WINDOWS]: {
		[ModifierKey.META]: 'Ctrl',
		[ModifierKey.CTRL]: 'Ctrl',
		[ModifierKey.ALT]: 'Alt',
		[ModifierKey.SHIFT]: 'Shift'
	},
	[Platform.LINUX]: {
		[ModifierKey.META]: 'Super',
		[ModifierKey.CTRL]: 'Ctrl',
		[ModifierKey.ALT]: 'Alt',
		[ModifierKey.SHIFT]: 'Shift'
	}
} as const

export const ModifierDisplayOrder: Record<PlatformType, ModifierKeyType[]> = {
	[Platform.MAC]: [ModifierKey.CTRL, ModifierKey.ALT, ModifierKey.SHIFT, ModifierKey.META],
	[Platform.WINDOWS]: [ModifierKey.META, ModifierKey.ALT, ModifierKey.SHIFT, ModifierKey.CTRL],
	[Platform.LINUX]: [ModifierKey.META, ModifierKey.ALT, ModifierKey.SHIFT, ModifierKey.CTRL]
} as const
