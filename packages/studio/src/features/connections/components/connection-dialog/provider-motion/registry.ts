import { track, type IconSpec } from './motion'

const CYLINDER_LID = { id: 'lid', d: 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0-18 0z' }
const CYLINDER_BODY = { id: 'body', d: 'M3 5v14a9 3 0 0 0 18 0V5' }

const STRETCH = { ease: 'spring', duration: 820 } as const

const cylinderStretch = [
	track(
		['body'],
		[12, 22],
		[{ at: 0 }, { at: 0.2, scaleY: 0.94 }, { at: 0.5, scaleY: 1.07 }, { at: 1 }],
		STRETCH
	),
	track(
		['lid'],
		[12, 5],
		[{ at: 0 }, { at: 0.2, y: 1 }, { at: 0.5, y: -1.2 }, { at: 1 }],
		STRETCH
	)
]

const CLOUD = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'

export const PROVIDER_ICONS = {
	postgres: {
		parts: [CYLINDER_BODY, { id: 'band', d: 'M3 12a9 3 0 0 0 18 0' }, CYLINDER_LID],
		tracks: [
			...cylinderStretch,
			track(
				['band'],
				[12, 12],
				[{ at: 0 }, { at: 0.2, y: 0.6 }, { at: 0.5, y: -0.7 }, { at: 1 }],
				STRETCH
			)
		]
	},
	mysql: {
		parts: [CYLINDER_BODY, CYLINDER_LID],
		tracks: cylinderStretch
	},
	cockroach: {
		parts: [
			{
				id: 'top',
				d: 'M10 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'
			},
			{ id: 'stem', d: 'M12 8v4' },
			{ id: 'bus', d: 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3' },
			{
				id: 'left',
				d: 'M3 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z'
			},
			{
				id: 'right',
				d: 'M17 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z'
			}
		],
		tracks: [
			track(['top'], [12, 5], [{ at: 0 }, { at: 0.4, y: -1.2 }, { at: 1 }], {
				ease: 'spring',
				duration: 800
			}),
			track(['stem', 'bus'], [12, 12], [{ at: 0 }, { at: 0.4, scaleY: 1.3 }, { at: 1 }], {
				ease: 'spring',
				duration: 800
			}),
			track(['left', 'right'], [12, 19], [{ at: 0 }, { at: 0.4, y: 1.2 }, { at: 1 }], {
				ease: 'spring',
				duration: 800
			})
		]
	},
	mariadb: {
		parts: [
			{
				id: 'rackTop',
				d: 'M4 3h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'
			},
			{
				id: 'rackBottom',
				d: 'M4 14h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z'
			},
			{ id: 'ledTop', d: 'M6 6.5h.01' },
			{ id: 'ledBottom', d: 'M6 17.5h.01' }
		],
		tracks: [
			track(['rackTop', 'ledTop'], [12, 6.5], [{ at: 0 }, { at: 0.4, x: 1.6 }, { at: 1 }], {
				ease: 'spring',
				duration: 800
			}),
			track(
				['rackBottom', 'ledBottom'],
				[12, 17.5],
				[{ at: 0 }, { at: 0.4, x: 1.6 }, { at: 1 }],
				{ ease: 'spring', duration: 800, delay: 120 }
			)
		]
	},
	sqlite: {
		parts: [
			{
				id: 'case',
				d: 'M3 13l2.2-7.2A2 2 0 0 1 7.1 4.5h9.8a2 2 0 0 1 1.9 1.3L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
			},
			{ id: 'seam', d: 'M3 13h18' },
			{ id: 'ledA', d: 'M7 16.5h.01' },
			{ id: 'ledB', d: 'M11 16.5h.01' }
		],
		tracks: [
			track(
				['case', 'seam', 'ledA', 'ledB'],
				[3, 20],
				[{ at: 0 }, { at: 0.3, rotate: -7 }, { at: 0.6, rotate: 0.8 }, { at: 1 }],
				{ ease: 'inout' }
			)
		]
	},
	libsql: {
		parts: [
			{
				id: 'boxTop',
				d: 'M9.5 2.5h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 9V4a1.5 1.5 0 0 1 1.5-1.5z'
			},
			{
				id: 'boxLeft',
				d: 'M4 13.5h5a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 9 21.5H4A1.5 1.5 0 0 1 2.5 20v-5A1.5 1.5 0 0 1 4 13.5z'
			},
			{
				id: 'boxRight',
				d: 'M15 13.5h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5a1.5 1.5 0 0 1 1.5-1.5z'
			}
		],
		tracks: [
			track(
				['boxTop'],
				[12, 10.5],
				[{ at: 0 }, { at: 0.35, y: -2, rotate: -8 }, { at: 0.7, y: 0.3 }, { at: 1 }],
				{ ease: 'inout', duration: 800 }
			),
			track(
				['boxLeft'],
				[6.5, 21.5],
				[{ at: 0 }, { at: 0.55 }, { at: 0.7, scaleY: 0.9 }, { at: 1 }],
				{ duration: 800 }
			),
			track(
				['boxRight'],
				[17.5, 21.5],
				[{ at: 0 }, { at: 0.55 }, { at: 0.7, scaleY: 0.9 }, { at: 1 }],
				{ duration: 800 }
			)
		]
	},
	duckdb: {
		parts: [
			{
				id: 'body',
				d: 'M13 10.2c-.6.6-1 1.4-1 2.3H4.2a1.2 1.2 0 0 0-1.2 1.4c.6 3.8 3.6 6.6 7.5 6.6h4c3.6 0 6.5-2.7 6.5-6 0-1.6-.7-3-1.8-4'
			},
			{ id: 'head', d: 'M12 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0z' },
			{ id: 'bill', d: 'M18.6 6h2.7a1 1 0 0 1 0 2h-2.6' },
			{ id: 'eye', d: 'M16.5 6.4h.01' }
		],
		tracks: [
			track(
				['head', 'bill', 'eye'],
				[14, 10.5],
				[{ at: 0 }, { at: 0.3, rotate: 16 }, { at: 0.65, rotate: -3 }, { at: 1 }],
				{ ease: 'inout' }
			)
		]
	},
	d1: {
		parts: [
			{ id: 'cloud', d: CLOUD },
			{ id: 'rowA', d: 'M7 13h6' },
			{ id: 'rowB', d: 'M7 16h9' }
		],
		tracks: [
			track(
				['rowA'],
				[7, 13],
				[{ at: 0 }, { at: 0.3, scaleX: 0.5 }, { at: 0.65, scaleX: 1.15 }, { at: 1 }]
			),
			track(
				['rowB'],
				[7, 16],
				[{ at: 0 }, { at: 0.3, scaleX: 0.6 }, { at: 0.65, scaleX: 1.08 }, { at: 1 }],
				{ delay: 110 }
			)
		]
	},
	cloudflare: {
		parts: [
			{ id: 'cloud', d: 'M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' },
			{ id: 'dashA', d: 'M4 21h7' },
			{ id: 'dashB', d: 'M14 21h5' }
		],
		tracks: [
			track(['cloud'], [12, 12], [{ at: 0 }, { at: 0.35, x: 1 }, { at: 1 }], {
				ease: 'spring'
			}),
			track(['dashA', 'dashB'], [12, 21], [{ at: 0 }, { at: 0.35, x: 2 }, { at: 1 }], {
				ease: 'spring',
				delay: 50
			})
		]
	},
	posthog: {
		parts: [
			{ id: 'axes', d: 'M3 3v18h18' },
			{ id: 'barShort', d: 'M8 17v-3' },
			{ id: 'barTall', d: 'M13 17V5' },
			{ id: 'barMid', d: 'M18 17V9' }
		],
		tracks: [
			track(
				['barShort'],
				[8, 17],
				[{ at: 0 }, { at: 0.3, scaleY: 0.5 }, { at: 0.65, scaleY: 1.12 }, { at: 1 }],
				{ duration: 800 }
			),
			track(
				['barTall'],
				[13, 17],
				[{ at: 0 }, { at: 0.3, scaleY: 0.5 }, { at: 0.65, scaleY: 1.06 }, { at: 1 }],
				{ duration: 800, delay: 80 }
			),
			track(
				['barMid'],
				[18, 17],
				[{ at: 0 }, { at: 0.3, scaleY: 0.5 }, { at: 0.65, scaleY: 1.1 }, { at: 1 }],
				{ duration: 800, delay: 160 }
			)
		]
	},
	files: {
		parts: [
			{ id: 'page', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' },
			{ id: 'fold', d: 'M14 3v5h5' },
			{ id: 'lineA', d: 'M9 13h6' },
			{ id: 'lineB', d: 'M9 17h6' }
		],
		tracks: [
			track(['lineA'], [12, 13], [{ at: 0 }, { at: 0.4, y: -1.4 }, { at: 1 }], {
				ease: 'spring',
				duration: 800
			}),
			track(['lineB'], [12, 17], [{ at: 0 }, { at: 0.4, y: -1.4 }, { at: 1 }], {
				ease: 'spring',
				duration: 800,
				delay: 70
			})
		]
	}
} as const satisfies Record<string, IconSpec>

export type ProviderIconName = keyof typeof PROVIDER_ICONS
