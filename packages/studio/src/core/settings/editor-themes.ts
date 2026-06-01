export type MonacoTheme =
	| 'dracula'
	| 'nord'
	| 'monokai'
	| 'github-dark'
	| 'github-light'
	| 'vs'
	| 'vs-dark'

const themeCache: Record<string, any> = {}

export async function loadTheme(themeName: MonacoTheme): Promise<any | null> {
	if (themeName === 'vs' || themeName === 'vs-dark') {
		return null
	}

	if (themeCache[themeName]) {
		return themeCache[themeName]
	}

	const themeData = await importTheme(themeName)
	if (themeData) {
		themeCache[themeName] = themeData
	}
	return themeData
}

async function importTheme(themeName: string): Promise<any | null> {
	switch (themeName) {
		case 'dracula':
			return (await import('./themes/dracula.json')).default
		case 'nord':
			return (await import('./themes/nord.json')).default
		case 'monokai':
			return (await import('./themes/monokai.json')).default
		case 'github-dark':
			return (await import('./themes/github-dark.json')).default
		case 'github-light':
			return (await import('./themes/github-light.json')).default
		default:
			return null
	}
}

export function isBuiltinTheme(theme: string): boolean {
	return theme === 'vs' || theme === 'vs-dark'
}
