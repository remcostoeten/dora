import { describe, expect, it } from 'vitest'
import { cssTransform, resolvePose, type IconSpec } from './motion'
import { PROVIDER_ICONS } from './registry'

const SPECS: [string, IconSpec][] = Object.entries<IconSpec>(PROVIDER_ICONS)

function isRest(pose: ReturnType<typeof resolvePose>): boolean {
	return (
		pose.x === 0 && pose.y === 0 && pose.rotate === 0 && pose.scaleX === 1 && pose.scaleY === 1
	)
}

describe('cssTransform', () => {
	it('orders translate, rotate and scale', () => {
		expect(cssTransform(resolvePose({ x: 1, rotate: -10, scale: 0.8 }))).toBe(
			'translate(1px, 0px) rotate(-10deg) scale(0.8, 0.8)'
		)
	})
})

describe.each(SPECS)('%s provider icon', (_name, spec) => {
	const partIds = spec.parts.map((part) => part.id)

	it('has unique part ids', () => {
		expect(new Set(partIds).size).toBe(partIds.length)
	})

	it('animates only parts that exist, each in a single track', () => {
		const moved = spec.tracks.flatMap((track) => track.parts)
		for (const part of moved) expect(partIds).toContain(part)
		expect(new Set(moved).size).toBe(moved.length)
	})

	it('runs every track from offset 0 to 1 in ascending order', () => {
		for (const track of spec.tracks) {
			const offsets = track.keyframes.map((keyframe) => keyframe.at)
			expect(offsets[0]).toBe(0)
			expect(offsets[offsets.length - 1]).toBe(1)
			expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
		}
	})

	it('starts and ends every track on the resting pose', () => {
		for (const track of spec.tracks) {
			expect(isRest(resolvePose(track.keyframes[0]!))).toBe(true)
			expect(isRest(resolvePose(track.keyframes[track.keyframes.length - 1]!))).toBe(true)
		}
	})
})
