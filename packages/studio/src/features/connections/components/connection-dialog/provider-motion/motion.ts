export type Pose = {
	x?: number
	y?: number
	rotate?: number
	scale?: number
	scaleX?: number
	scaleY?: number
}

type ResolvedPose = Required<Omit<Pose, 'scale'>>

export const EASINGS = {
	out: 'cubic-bezier(0.22, 1, 0.36, 1)',
	inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
	spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
} as const

type EasingToken = keyof typeof EASINGS

export type PoseKeyframe = Pose & { at: number }

export type Track = {
	parts: readonly string[]
	duration: number
	delay: number
	ease: EasingToken
	origin: readonly [number, number]
	keyframes: readonly PoseKeyframe[]
}

export type IconPart = { id: string; d: string }

export type IconSpec = {
	parts: readonly IconPart[]
	tracks: readonly Track[]
}

type TrackOptions = { duration?: number; delay?: number; ease?: EasingToken }

/**
 * @name track
 * @description Builds one motion track: the parts it moves, the point they move
 * about in 24 unit icon space, and poses relative to rest at offsets 0 to 1.
 *
 * @example
 * track(['lid'], [12, 5], [{ at: 0 }, { at: 0.5, y: -1.2 }, { at: 1 }], { ease: 'spring' })
 */
export function track(
	parts: readonly string[],
	origin: readonly [number, number],
	keyframes: readonly PoseKeyframe[],
	options: TrackOptions = {}
): Track {
	return {
		parts,
		origin,
		keyframes,
		duration: options.duration ?? 760,
		delay: options.delay ?? 0,
		ease: options.ease ?? 'out'
	}
}

/**
 * @name resolvePose
 * @description Fills in the identity for every field a keyframe leaves out.
 *
 * @example
 * resolvePose({ scale: 0.8 }) // { x: 0, y: 0, rotate: 0, scaleX: 0.8, scaleY: 0.8 }
 */
export function resolvePose(pose: Pose): ResolvedPose {
	return {
		x: pose.x ?? 0,
		y: pose.y ?? 0,
		rotate: pose.rotate ?? 0,
		scaleX: pose.scaleX ?? pose.scale ?? 1,
		scaleY: pose.scaleY ?? pose.scale ?? 1
	}
}

/**
 * @name cssTransform
 * @description Writes a pose as a CSS transform in translate, rotate, scale order.
 *
 * @example
 * cssTransform(resolvePose({ y: -1.4 })) // 'translate(0px, -1.4px) rotate(0deg) scale(1, 1)'
 */
export function cssTransform(pose: ResolvedPose): string {
	return `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scaleX}, ${pose.scaleY})`
}
