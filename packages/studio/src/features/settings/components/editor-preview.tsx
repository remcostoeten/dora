import type { SettingsState } from '@studio/core/settings'
import { cn } from '@studio/shared/utils/cn'

type EditorPalette = {
	background: string
	foreground: string
	keyword: string
	fn: string
	string: string
	number: string
	comment: string
	gutter: string
	current: string
}

type Token = 'k' | 'f' | 's' | 'n' | 'c' | 'p' | 't'

type Line = [Token, string][]

type EditorTheme = SettingsState['editorTheme']

type PaletteKey = Exclude<EditorTheme, 'auto'>

const PALETTES: Record<PaletteKey, EditorPalette> = {
	'vs-dark': {
		background: '#1e1e1e',
		foreground: '#d4d4d4',
		keyword: '#569cd6',
		fn: '#dcdcaa',
		string: '#ce9178',
		number: '#b5cea8',
		comment: '#6a9955',
		gutter: '#858585',
		current: 'rgba(255,255,255,0.05)'
	},
	vs: {
		background: '#ffffff',
		foreground: '#000000',
		keyword: '#0000ff',
		fn: '#795e26',
		string: '#a31515',
		number: '#098658',
		comment: '#008000',
		gutter: '#237893',
		current: 'rgba(0,0,0,0.05)'
	},
	dracula: {
		background: '#282a36',
		foreground: '#f8f8f2',
		keyword: '#ff79c6',
		fn: '#50fa7b',
		string: '#f1fa8c',
		number: '#bd93f9',
		comment: '#6272a4',
		gutter: '#6272a4',
		current: 'rgba(255,255,255,0.05)'
	},
	nord: {
		background: '#2e3440',
		foreground: '#d8dee9',
		keyword: '#81a1c1',
		fn: '#88c0d0',
		string: '#a3be8c',
		number: '#b48ead',
		comment: '#616e88',
		gutter: '#616e88',
		current: 'rgba(255,255,255,0.05)'
	},
	monokai: {
		background: '#272822',
		foreground: '#f8f8f2',
		keyword: '#f92672',
		fn: '#a6e22e',
		string: '#e6db74',
		number: '#ae81ff',
		comment: '#75715e',
		gutter: '#75715e',
		current: 'rgba(255,255,255,0.05)'
	},
	'github-dark': {
		background: '#24292e',
		foreground: '#f6f8fa',
		keyword: '#ea4a5a',
		fn: '#b392f0',
		string: '#79b8ff',
		number: '#c8e1ff',
		comment: '#959da5',
		gutter: '#6a737d',
		current: 'rgba(255,255,255,0.05)'
	},
	'github-light': {
		background: '#ffffff',
		foreground: '#24292e',
		keyword: '#d73a49',
		fn: '#6f42c1',
		string: '#032f62',
		number: '#005cc5',
		comment: '#6a737d',
		gutter: '#959da5',
		current: 'rgba(0,0,0,0.05)'
	}
}

const THEME_LABELS: Record<EditorTheme, string> = {
	auto: 'Auto (System)',
	vs: 'Light (Default)',
	'vs-dark': 'Dark (Default)',
	dracula: 'Dracula',
	nord: 'Nord',
	monokai: 'Monokai',
	'github-dark': 'GitHub Dark',
	'github-light': 'GitHub Light'
}

const CURRENT_LINE = 4

const SQL: Line[] = [
	[['c', '-- Revenue per region, last 30 days']],
	[
		['k', 'SELECT'],
		['t', ' r.name '],
		['k', 'AS'],
		['t', ' region,']
	],
	[
		['t', '       '],
		['f', 'count'],
		['p', '('],
		['t', 'o.id'],
		['p', ')'],
		['t', ' '],
		['k', 'AS'],
		['t', ' orders,']
	],
	[
		['t', '       '],
		['f', 'round'],
		['p', '('],
		['f', 'sum'],
		['p', '('],
		['t', 'o.total_cents'],
		['p', ')'],
		['t', ' / '],
		['n', '100.0'],
		['t', ', '],
		['n', '2'],
		['p', ')'],
		['t', ' '],
		['k', 'AS'],
		['t', ' revenue']
	],
	[
		['k', 'FROM'],
		['t', ' orders o']
	],
	[
		['k', 'JOIN'],
		['t', ' regions r '],
		['k', 'ON'],
		['t', ' r.id = o.region_id']
	],
	[
		['k', 'WHERE'],
		['t', ' o.created_at >= '],
		['f', 'now'],
		['p', '()'],
		['t', ' - '],
		['k', 'interval'],
		['t', ' '],
		['s', "'30 days'"]
	],
	[
		['k', 'GROUP BY'],
		['t', ' r.name']
	],
	[
		['k', 'ORDER BY'],
		['t', ' revenue '],
		['k', 'DESC']
	],
	[
		['k', 'LIMIT'],
		['t', ' '],
		['n', '10'],
		['t', ';']
	]
]

function colorOf(token: Token, palette: EditorPalette) {
	switch (token) {
		case 'k':
			return palette.keyword
		case 'f':
			return palette.fn
		case 's':
			return palette.string
		case 'n':
			return palette.number
		case 'c':
			return palette.comment
		default:
			return palette.foreground
	}
}

type Props = {
	fontSize: number
	theme: EditorTheme
	vim: boolean
	appIsLight: boolean
}

export function EditorPreview({ fontSize, theme, vim, appIsLight }: Props) {
	const resolved: PaletteKey = theme === 'auto' ? (appIsLight ? 'vs' : 'vs-dark') : theme
	const palette = PALETTES[resolved]

	return (
		<div
			className='overflow-hidden rounded-lg border border-border transition-colors duration-150'
			style={{ backgroundColor: palette.background, color: palette.foreground }}
		>
			<div
				className='flex h-8 items-center gap-2.5 border-b px-3 text-[11.5px]'
				style={{ borderColor: `${palette.foreground}22`, color: palette.gutter }}
			>
				<span style={{ color: palette.foreground }}>orders_by_region.sql</span>
				<span className='ml-auto'>PostgreSQL · prod-analytics</span>
			</div>
			<div
				className='overflow-x-auto py-2.5 font-mono transition-[font-size] duration-150'
				style={{ fontSize, lineHeight: 1.6 }}
			>
				{SQL.map((line, index) => (
					<div
						key={index}
						className='grid grid-cols-[4ch_minmax(0,1fr)] gap-x-3.5 pr-4'
						style={
							index === CURRENT_LINE
								? { backgroundColor: palette.current }
								: undefined
						}
					>
						<span
							className='select-none text-right'
							style={{ color: palette.gutter }}
							aria-hidden='true'
						>
							{index + 1}
						</span>
						<span className='whitespace-pre'>
							{line.map(([token, text], tokenIndex) => (
								<span
									key={tokenIndex}
									style={{
										color: colorOf(token, palette),
										fontWeight: token === 'k' ? 600 : undefined
									}}
								>
									{text}
								</span>
							))}
							{index === CURRENT_LINE ? (
								<span
									aria-hidden='true'
									className={cn(
										'inline-block align-text-bottom',
										vim ? 'w-[0.6em] opacity-60' : 'w-[1.5px]'
									)}
									style={{
										height: '1.15em',
										backgroundColor: palette.foreground
									}}
								/>
							) : null}
						</span>
					</div>
				))}
			</div>
			<div
				className='flex h-[26px] items-center gap-3.5 border-t px-3 font-mono text-[11px]'
				style={{ borderColor: `${palette.foreground}22`, color: palette.gutter }}
			>
				{vim ? (
					<span
						className='rounded-sm px-1.5 py-px font-bold tracking-wider'
						style={{ backgroundColor: palette.foreground, color: palette.background }}
					>
						NORMAL
					</span>
				) : null}
				<span>Ln 5, Col 12</span>
				<span className='ml-auto'>{THEME_LABELS[theme]}</span>
				<span>{fontSize}px</span>
				<span>UTF-8</span>
			</div>
		</div>
	)
}
