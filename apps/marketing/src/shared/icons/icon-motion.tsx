'use client'

import { useEffect } from 'react'
import {
    easings,
    iconMotions,
    isMotionIcon,
    type MotionIcon,
    poseTransform,
    type Track
} from './motion'

const hostSelector = "a[href], button, [role='button']"
const motionQuery =
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

function playIcon(svg: SVGSVGElement, icon: MotionIcon) {
    if (svg.dataset.playing === 'true') return
    const tracks: readonly Track[] = iconMotions[icon]
    const animations = tracks.flatMap((track) => {
        const keyframes = track.keyframes.map((keyframe) => ({
            offset: keyframe.at,
            transform: poseTransform(keyframe),
            easing: easings[keyframe.ease ?? track.ease]
        }))
        return [
            ...svg.querySelectorAll<SVGGElement>(`[data-part="${track.part}"]`)
        ].map((part) =>
            part.animate(keyframes, {
                duration: track.duration,
                delay: track.delay ?? 0,
                fill: 'both'
            })
        )
    })
    if (animations.length === 0) return
    svg.dataset.playing = 'true'
    void Promise.allSettled(
        animations.map((animation) => animation.finished)
    ).then(() => {
        for (const animation of animations) animation.cancel()
        delete svg.dataset.playing
    })
}

let hoveredHost: Element | null = null

function playHost(host: Element) {
    if (!window.matchMedia(motionQuery).matches) return
    for (const svg of host.querySelectorAll<SVGSVGElement>('svg[data-icon]')) {
        const icon = svg.dataset.icon
        if (isMotionIcon(icon)) playIcon(svg, icon)
    }
}

function onPointerMove(event: PointerEvent) {
    const host =
        event.target instanceof Element
            ? event.target.closest(hostSelector)
            : null
    if (host === hoveredHost) return
    const replacedUnderPointer =
        hoveredHost !== null && !hoveredHost.isConnected
    hoveredHost = host
    if (host && !replacedUnderPointer) playHost(host)
}

function onPointerOut(event: PointerEvent) {
    if (event.relatedTarget === null) hoveredHost = null
}

export function IconMotion() {
    useEffect(() => {
        document.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerout', onPointerOut)
        return () => {
            document.removeEventListener('pointermove', onPointerMove)
            document.removeEventListener('pointerout', onPointerOut)
        }
    }, [])

    return null
}
