import { cssTransform, EASINGS, resolvePose, type IconSpec, type Track } from './motion'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function webKeyframes(track: Track): Keyframe[] {
	return track.keyframes.map((keyframe) => ({
		offset: keyframe.at,
		transform: cssTransform(resolvePose(keyframe)),
		easing: EASINGS[track.ease]
	}))
}

/**
 * @name playIconMotion
 * @description Plays an icon's motion once with the Web Animations API. Every
 * track starts and ends on the resting pose and nothing is hidden or redrawn,
 * so the icon never flashes. Ignored while a run is live or when the user
 * prefers reduced motion.
 *
 * @example
 * row.addEventListener('pointerenter', () => playIconMotion(svg, PROVIDER_ICONS.postgres))
 */
export function playIconMotion(svg: SVGSVGElement, spec: IconSpec): boolean {
	if (typeof svg.animate !== 'function') return false
	if (svg.dataset.iconPlaying === 'true') return false
	if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false
	const animations = spec.tracks.flatMap((track) => {
		const keyframes = webKeyframes(track)
		return track.parts.flatMap((part) =>
			[...svg.querySelectorAll<SVGElement>(`[data-icon-part="${part}"]`)].map((element) =>
				element.animate(keyframes, {
					duration: track.duration,
					delay: track.delay,
					fill: 'both'
				})
			)
		)
	})
	if (animations.length === 0) return false
	svg.dataset.iconPlaying = 'true'
	void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
		for (const animation of animations) animation.cancel()
		delete svg.dataset.iconPlaying
	})
	return true
}
