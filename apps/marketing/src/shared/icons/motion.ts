export const easings = {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    sine: 'cubic-bezier(0.37, 0, 0.63, 1)',
    swing: 'cubic-bezier(0.33, 0, 0.67, 1)'
} as const

export type EasingToken = keyof typeof easings

export type Pose = {
    x?: number
    y?: number
    rotate?: number
    scale?: number
    scaleX?: number
    scaleY?: number
}

export type Keyframe = Pose & {
    at: number
    ease?: EasingToken
}

export type Track = {
    part: string
    duration: number
    delay?: number
    ease: EasingToken
    origin: readonly [number, number]
    keyframes: readonly Keyframe[]
}

function wobble(
    part: string,
    origin: readonly [number, number],
    angle: number
): Track {
    return {
        part,
        duration: 1000,
        ease: 'sine',
        origin,
        keyframes: [
            { at: 0, ease: 'swing' },
            { at: 0.2, rotate: angle },
            { at: 0.42, rotate: angle * -0.6 },
            { at: 0.62, rotate: angle * 0.3 },
            { at: 0.8, rotate: angle * -0.1 },
            { at: 1 }
        ]
    }
}

function retract(part: string, y: number, delay: number): Track {
    return {
        part,
        duration: 700,
        delay,
        ease: 'spring',
        origin: [8, y],
        keyframes: [{ at: 0 }, { at: 0.4, scaleX: 0.35 }, { at: 1 }]
    }
}

/**
 * @name iconMotions
 * @description One-shot hover motions per icon, as Web Animations keyframes
 * on named parts. Origins are in units of the 24-unit view box and every
 * motion ends exactly at rest, or on a rotation the glyph is symmetric under.
 *
 * @example
 * iconMotions.search[0].duration // 800
 */
export const iconMotions = {
    search: [
        {
            part: 'lens',
            duration: 800,
            ease: 'out',
            origin: [11, 11],
            keyframes: [
                { at: 0 },
                { at: 0.35, x: -0.8, y: -0.8, rotate: -16 },
                { at: 0.7, rotate: 5, ease: 'inout' },
                { at: 1 }
            ]
        }
    ],
    book: [
        {
            part: 'left',
            duration: 760,
            ease: 'spring',
            origin: [12, 21],
            keyframes: [{ at: 0 }, { at: 0.4, rotate: 7, y: -0.4 }, { at: 1 }]
        },
        {
            part: 'right',
            duration: 760,
            delay: 40,
            ease: 'spring',
            origin: [12, 21],
            keyframes: [{ at: 0 }, { at: 0.4, rotate: -7, y: -0.4 }, { at: 1 }]
        }
    ],
    folder: [
        {
            part: 'folder',
            duration: 760,
            ease: 'spring',
            origin: [2, 20],
            keyframes: [
                { at: 0 },
                { at: 0.38, y: -1.4, rotate: -6 },
                { at: 0.72, y: 0.3 },
                { at: 1 }
            ]
        }
    ],
    house: [
        {
            part: 'house',
            duration: 760,
            ease: 'out',
            origin: [12, 21],
            keyframes: [
                { at: 0 },
                { at: 0.22, scaleX: 1.06, scaleY: 0.9 },
                { at: 0.55, y: -1.6, scaleY: 1.04, ease: 'spring' },
                { at: 1 }
            ]
        }
    ],
    download: [
        {
            part: 'arrow',
            duration: 760,
            ease: 'spring',
            origin: [12, 9],
            keyframes: [
                { at: 0 },
                { at: 0.4, y: 2.6 },
                { at: 0.7, y: -0.8 },
                { at: 1 }
            ]
        },
        {
            part: 'tray',
            duration: 760,
            ease: 'out',
            origin: [12, 21],
            keyframes: [
                { at: 0 },
                { at: 0.36 },
                { at: 0.48, scaleX: 1.05, scaleY: 0.86 },
                { at: 1 }
            ]
        }
    ],
    rocket: [
        {
            part: 'ship',
            duration: 900,
            ease: 'out',
            origin: [12, 12],
            keyframes: [
                { at: 0 },
                { at: 0.28, x: -0.9, y: 0.9, ease: 'spring' },
                { at: 0.62, x: 2.2, y: -2.2, ease: 'inout' },
                { at: 1 }
            ]
        },
        {
            part: 'flame',
            duration: 900,
            ease: 'out',
            origin: [6, 18],
            keyframes: [
                { at: 0 },
                { at: 0.28, x: -0.9, y: 0.9, scale: 0.8, ease: 'spring' },
                { at: 0.62, x: 2.2, y: -2.2, scale: 1.35, ease: 'inout' },
                { at: 1 }
            ]
        }
    ],
    page: [retract('l1', 9, 0), retract('l2', 13, 80), retract('l3', 17, 160)],
    bulb: [wobble('glass', [12, 22], 12)],
    compass: [
        {
            part: 'needle',
            duration: 1000,
            ease: 'out',
            origin: [12, 12],
            keyframes: [
                { at: 0 },
                { at: 0.7, rotate: 200 },
                { at: 1, rotate: 180, ease: 'inout' }
            ]
        }
    ],
    cloud: [
        {
            part: 'cloud',
            duration: 900,
            ease: 'inout',
            origin: [12, 14],
            keyframes: [
                { at: 0 },
                { at: 0.4, x: 1.8 },
                { at: 0.75, x: -0.6 },
                { at: 1 }
            ]
        }
    ],
    route: [
        {
            part: 'end',
            duration: 760,
            ease: 'spring',
            origin: [18, 8],
            keyframes: [
                { at: 0 },
                { at: 0.2, scaleY: 0.85 },
                { at: 0.5, y: -2.2 },
                { at: 1 }
            ]
        },
        {
            part: 'start',
            duration: 760,
            delay: 120,
            ease: 'spring',
            origin: [6, 22],
            keyframes: [
                { at: 0 },
                { at: 0.2, scaleY: 0.85 },
                { at: 0.5, y: -2.2 },
                { at: 1 }
            ]
        }
    ],
    palette: [wobble('palette', [12, 22], -14)],
    menu: [
        {
            part: 'm1',
            duration: 700,
            ease: 'spring',
            origin: [4, 5],
            keyframes: [{ at: 0 }, { at: 0.4, scaleX: 0.55 }, { at: 1 }]
        },
        {
            part: 'm2',
            duration: 700,
            delay: 60,
            ease: 'spring',
            origin: [4, 12],
            keyframes: [{ at: 0 }, { at: 0.4, scaleX: 0.8 }, { at: 1 }]
        },
        {
            part: 'm3',
            duration: 700,
            delay: 120,
            ease: 'spring',
            origin: [4, 19],
            keyframes: [{ at: 0 }, { at: 0.4, scaleX: 0.4 }, { at: 1 }]
        }
    ],
    close: [
        {
            part: 'cross',
            duration: 620,
            ease: 'out',
            origin: [12, 12],
            keyframes: [
                { at: 0 },
                { at: 0.4, rotate: 60, scale: 0.8 },
                { at: 1, rotate: 90 }
            ]
        }
    ],
    sun: [
        {
            part: 'rays',
            duration: 900,
            ease: 'out',
            origin: [12, 12],
            keyframes: [
                { at: 0 },
                { at: 0.65, rotate: 100 },
                { at: 1, rotate: 90, ease: 'inout' }
            ]
        },
        {
            part: 'core',
            duration: 900,
            ease: 'spring',
            origin: [12, 12],
            keyframes: [{ at: 0 }, { at: 0.3, scale: 0.8 }, { at: 1 }]
        }
    ],
    moon: [
        {
            part: 'moon',
            duration: 900,
            ease: 'out',
            origin: [12, 12],
            keyframes: [
                { at: 0 },
                { at: 0.3, rotate: -22 },
                { at: 0.62, rotate: 8, ease: 'inout' },
                { at: 1 }
            ]
        }
    ]
} as const satisfies Record<string, readonly Track[]>

export type MotionIcon = keyof typeof iconMotions

/**
 * @name isMotionIcon
 * @description True when the icon name has a hover motion.
 *
 * @example
 * if (isMotionIcon(svg.dataset.icon)) playIcon(svg, svg.dataset.icon)
 */
export function isMotionIcon(name: string | undefined): name is MotionIcon {
    return name !== undefined && Object.hasOwn(iconMotions, name)
}

/**
 * @name poseTransform
 * @description CSS transform for a pose, in view box units.
 *
 * @example
 * poseTransform({ y: -1, rotate: 6 }) // "translate(0px, -1px) rotate(6deg) scale(1, 1)"
 */
export function poseTransform({
    x = 0,
    y = 0,
    rotate = 0,
    scale = 1,
    scaleX,
    scaleY
}: Pose) {
    return `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scaleX ?? scale}, ${scaleY ?? scale})`
}
