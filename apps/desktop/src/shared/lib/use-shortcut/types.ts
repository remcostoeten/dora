export type AlphaKey =
	| 'a'
	| 'b'
	| 'c'
	| 'd'
	| 'e'
	| 'f'
	| 'g'
	| 'h'
	| 'i'
	| 'j'
	| 'k'
	| 'l'
	| 'm'
	| 'n'
	| 'o'
	| 'p'
	| 'q'
	| 'r'
	| 's'
	| 't'
	| 'u'
	| 'v'
	| 'w'
	| 'x'
	| 'y'
	| 'z'

export type NumericKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type FunctionKey =
	| 'f1'
	| 'f2'
	| 'f3'
	| 'f4'
	| 'f5'
	| 'f6'
	| 'f7'
	| 'f8'
	| 'f9'
	| 'f10'
	| 'f11'
	| 'f12'

export type NavigationKey =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'arrowup'
	| 'arrowdown'
	| 'arrowleft'
	| 'arrowright'
	| 'home'
	| 'end'
	| 'pageup'
	| 'pagedown'

export type SpecialKey =
	| 'enter'
	| 'return'
	| 'escape'
	| 'esc'
	| 'space'
	| 'tab'
	| 'backspace'
	| 'delete'
	| 'del'
	| 'insert'

export type SymbolKey =
	| 'minus'
	| 'plus'
	| 'equal'
	| 'equals'
	| 'bracketleft'
	| 'bracketright'
	| 'backslash'
	| 'slash'
	| '/'
	| 'comma'
	| 'period'
	| 'semicolon'
	| 'quote'
	| 'backtick'

export type ActionKey = AlphaKey | NumericKey | FunctionKey | NavigationKey | SpecialKey | SymbolKey

export type ModifierName = 'ctrl' | 'shift' | 'alt' | 'cmd' | 'mod'

export type ModifierFlags = {
	ctrl: boolean
	shift: boolean
	alt: boolean
	cmd: boolean
}

export type ModifierState = {
	meta: boolean
	ctrl: boolean
	alt: boolean
	shift: boolean
}

export type ParsedShortcut = {
	modifiers: ModifierState
	key: string
	original: string
}

export type EmptyModifiers = {}

export type ShortcutHandler = (event: KeyboardEvent) => void

export type ExceptPredicate = (event: KeyboardEvent) => boolean

export type ExceptPreset = 'input' | 'editable' | 'typing' | 'modal' | 'disabled'

export type HandlerOptions = {
	preventDefault?: boolean
	stopPropagation?: boolean
	delay?: number
	description?: string
	disabled?: boolean
	scope?: HTMLElement | null
	except?: ExceptPreset | ExceptPreset[] | ExceptPredicate
}

export type ShortcutResult = {
	unbind: () => void
	display: string
	combo: string
	trigger: () => void
	isEnabled: boolean
	enable: () => void
	disable: () => void
	onAttempt?: (callback: (matched: boolean, event: KeyboardEvent) => void) => () => void
}

export type RemainingModifiers<Used extends Partial<ModifierFlags>> = Exclude<
	ModifierName,
	| (Used extends { ctrl: true } ? 'ctrl' : never)
	| (Used extends { shift: true } ? 'shift' : never)
	| (Used extends { alt: true } ? 'alt' : never)
	| (Used extends { cmd: true } ? 'cmd' | 'mod' : never)
>

export type ModifierChain<Used extends Partial<ModifierFlags>> = {
	ctrl: Used['ctrl'] extends true ? never : ModifierChain<Used & { ctrl: true }>
	shift: Used['shift'] extends true ? never : ModifierChain<Used & { shift: true }>
	alt: Used['alt'] extends true ? never : ModifierChain<Used & { alt: true }>
	cmd: Used['cmd'] extends true ? never : ModifierChain<Used & { cmd: true }>
	mod: Used['cmd'] extends true ? never : ModifierChain<Used & { cmd: true }>
	key: <K extends ActionKey>(key: K) => KeyChain<Used, K>
}

export type KeyChain<Used extends Partial<ModifierFlags>, Key extends ActionKey> = {
	on: (handler: ShortcutHandler, options?: HandlerOptions) => ShortcutResult
	handle: (options: HandlerOptions & { handler: ShortcutHandler }) => ShortcutResult
	except: (
		condition: ExceptPreset | ExceptPreset[] | ExceptPredicate
	) => KeyChainWithExcept<Used, Key>
}

export type KeyChainWithExcept<Used extends Partial<ModifierFlags>, Key extends ActionKey> = {
	on: (handler: ShortcutHandler, options?: Omit<HandlerOptions, 'except'>) => ShortcutResult
}

export type ShortcutBuilder = ModifierChain<EmptyModifiers> & {
	ctrl: ModifierChain<{ ctrl: true }>
	shift: ModifierChain<{ shift: true }>
	alt: ModifierChain<{ alt: true }>
	cmd: ModifierChain<{ cmd: true }>
	mod: ModifierChain<{ cmd: true }>
	key: <K extends ActionKey>(key: K) => KeyChain<EmptyModifiers, K>
}

export type UseShortcutOptions = {
	debug?: boolean
	delay?: number
	ignoreInputs?: boolean
	target?: HTMLElement | Window | null
	eventType?: 'keydown' | 'keyup'
	disabled?: boolean
}
