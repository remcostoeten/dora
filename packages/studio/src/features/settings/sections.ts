import {
	BarChart3,
	Bot,
	Cable,
	Code2,
	Cpu,
	Download,
	Hammer,
	HardDrive,
	Keyboard,
	KeyRound,
	LayoutPanelTop,
	Palette,
	Power,
	ShieldCheck,
	type LucideIcon
} from 'lucide-react'

export type SettingsSectionId =
	| 'editor'
	| 'appearance'
	| 'shortcuts'
	| 'ai-provider'
	| 'ollama-models'
	| 'ai-keys'
	| 'ai-usage'
	| 'storage'
	| 'build-cache'
	| 'safety'
	| 'agent-access'
	| 'startup'
	| 'interface'
	| 'updates'

export type SettingsSection = {
	id: SettingsSectionId
	title: string
	description: string
	icon: LucideIcon
	keywords: string[]
}

type SettingsGroup = {
	label: string
	items: SettingsSectionId[]
}

export const AI_SECTION_IDS: ReadonlySet<SettingsSectionId> = new Set([
	'ai-provider',
	'ollama-models',
	'ai-keys',
	'ai-usage'
])

export const SETTINGS_SECTIONS: Record<SettingsSectionId, SettingsSection> = {
	editor: {
		id: 'editor',
		title: 'Editor',
		description: 'Font size, syntax theme, and Vim mode',
		icon: Code2,
		keywords: ['font', 'theme', 'vim', 'code', 'sql']
	},
	appearance: {
		id: 'appearance',
		title: 'Appearance',
		description: 'Theme, color shift, and app typography',
		icon: Palette,
		keywords: ['theme', 'typography', 'colors', 'font', 'hue']
	},
	shortcuts: {
		id: 'shortcuts',
		title: 'Shortcuts',
		description: 'Keyboard bindings and overrides',
		icon: Keyboard,
		keywords: ['keyboard', 'hotkeys', 'keymap', 'keybinding']
	},
	interface: {
		id: 'interface',
		title: 'Interface',
		description: 'Selection bar, window controls, and toast behavior',
		icon: LayoutPanelTop,
		keywords: ['selection', 'toasts', 'ui', 'layout', 'window controls', 'traffic lights']
	},
	'ai-provider': {
		id: 'ai-provider',
		title: 'AI Provider',
		description: 'Active model provider and defaults',
		icon: Bot,
		keywords: [
			'openai',
			'anthropic',
			'gemini',
			'groq',
			'deepseek',
			'kimi',
			'glm',
			'qwen',
			'openrouter',
			'ollama',
			'model'
		]
	},
	'ollama-models': {
		id: 'ollama-models',
		title: 'Local models',
		description: 'Ollama status, pulls, and installed models',
		icon: Cpu,
		keywords: ['ollama', 'download', 'install', 'model']
	},
	'ai-keys': {
		id: 'ai-keys',
		title: 'AI Keys',
		description: 'Encrypted API keys per provider',
		icon: KeyRound,
		keywords: ['api key', 'secret', 'token', 'credentials']
	},
	'ai-usage': {
		id: 'ai-usage',
		title: 'AI Usage',
		description: 'Token totals, estimated cost, and recent requests',
		icon: BarChart3,
		keywords: ['usage', 'tokens', 'cost', 'requests']
	},
	startup: {
		id: 'startup',
		title: 'Startup',
		description: 'Default connection behavior',
		icon: Power,
		keywords: ['launch', 'restore', 'connect', 'open']
	},
	safety: {
		id: 'safety',
		title: 'Safety',
		description: 'Destructive action confirmations and privacy',
		icon: ShieldCheck,
		keywords: ['delete', 'confirm', 'danger', 'privacy', 'mask', 'hide', 'ai', 'assistant']
	},
	'agent-access': {
		id: 'agent-access',
		title: 'Agent access',
		description: 'Let coding agents use connections through MCP',
		icon: Cable,
		keywords: ['mcp', 'agent', 'claude', 'cursor', 'codex', 'permission', 'proposal']
	},
	storage: {
		id: 'storage',
		title: 'Storage',
		description: 'Database locations and switching',
		icon: HardDrive,
		keywords: ['database', 'location', 'switch', 'file']
	},
	updates: {
		id: 'updates',
		title: 'Updates',
		description: 'Check for and install app updates',
		icon: Download,
		keywords: ['update', 'upgrade', 'version', 'release', 'about']
	},
	'build-cache': {
		id: 'build-cache',
		title: 'Build cache',
		description: 'Inspect and clean local Tauri build artifacts',
		icon: Hammer,
		keywords: ['cargo', 'target', 'bundle', 'cache', 'clean', 'size']
	}
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
	{ label: 'Workspace', items: ['editor', 'appearance', 'shortcuts', 'interface'] },
	{ label: 'AI', items: ['ai-provider', 'ollama-models', 'ai-keys', 'ai-usage'] },
	{ label: 'Application', items: ['startup', 'safety', 'agent-access', 'storage', 'updates'] },
	{ label: 'Developer', items: ['build-cache'] }
]

export function groupLabelOf(id: SettingsSectionId) {
	return SETTINGS_GROUPS.find((group) => group.items.includes(id))?.label ?? ''
}
