'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { CornerTick } from '@/components/corner-tick'
import {
    featureUsesCaptureVideo,
    getFeatureCapturePaths,
    FEATURE_CAPTURE_SEEK_SEC
} from '@/core/config/feature-captures'
import type { TFeatureSlug } from '@/core/config/features'
import { useFrameDrawIn } from '@/shared/hooks/use-frame-draw-in'
import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'

const FRAME_LINE = 'pointer-events-none absolute z-[2] bg-line-strong'

type Props = {
    slug: TFeatureSlug
    label: string
    children: ReactNode
}

export function FeatureShowcaseShell({
    slug,
    label,
    children
}: Props) {
    const reducedMotion = usePrefersReducedMotion()
    const frame = useFrameDrawIn<HTMLDivElement>()
    const videoRef = useRef<HTMLVideoElement>(null)
    const { poster, video } = getFeatureCapturePaths(slug)
    const canUseVideo = featureUsesCaptureVideo(slug) && !reducedMotion
    const [captureReady, setCaptureReady] = useState(false)
    const [captureFailed, setCaptureFailed] = useState(false)

    useEffect(function resetCaptureState() {
        setCaptureReady(false)
        setCaptureFailed(false)
    }, [slug])

    const showCapture = captureReady && !captureFailed && canUseVideo
    const showMotion = !showCapture

    function primeCapture() {
        const node = videoRef.current
        if (!node || captureFailed || !canUseVideo) return

        const seekTo =
            FEATURE_CAPTURE_SEEK_SEC > 0
                ? Math.min(
                      FEATURE_CAPTURE_SEEK_SEC,
                      Math.max(0, node.duration - 0.15)
                  )
                : 0
        if (node.readyState >= 1 && Number.isFinite(node.duration) && seekTo > 0) {
            node.currentTime = seekTo
        }

        void node.play().catch(function () {
            setCaptureFailed(true)
        })
    }

    return (
        <figure className="feature-showcase">
            <div ref={frame.ref} className="feature-showcase__viewport">
                <span
                    className={`${FRAME_LINE} inset-x-0 top-0 h-px origin-center`}
                    style={frame.lineStyle('x')}
                />
                <span
                    className={`${FRAME_LINE} inset-x-0 bottom-0 h-px origin-center`}
                    style={frame.lineStyle('x')}
                />
                <span
                    className={`${FRAME_LINE} inset-y-0 left-0 w-px origin-center`}
                    style={frame.lineStyle('y')}
                />
                <span
                    className={`${FRAME_LINE} inset-y-0 right-0 w-px origin-center`}
                    style={frame.lineStyle('y')}
                />
                <CornerTick
                    className="-left-px -top-px -translate-x-1/2 -translate-y-1/2"
                    style={frame.tickStyle(0)}
                />
                <CornerTick
                    className="-right-px -top-px translate-x-1/2 -translate-y-1/2"
                    style={frame.tickStyle(1)}
                />
                <CornerTick
                    className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2"
                    style={frame.tickStyle(2)}
                />
                <CornerTick
                    className="-bottom-px -right-px translate-x-1/2 translate-y-1/2"
                    style={frame.tickStyle(3)}
                />
                {canUseVideo && !captureFailed ? (
                    <video
                        ref={videoRef}
                        key={video}
                        loop
                        muted
                        playsInline
                        preload="auto"
                        poster={poster}
                        aria-label={label}
                        className={
                            'feature-showcase__capture ' +
                            (showCapture
                                ? 'feature-showcase__capture--visible'
                                : 'feature-showcase__capture--hidden')
                        }
                        onLoadedMetadata={function () {
                            if (FEATURE_CAPTURE_SEEK_SEC > 0) {
                                primeCapture()
                            } else {
                                void videoRef.current?.play().catch(function () {
                                    setCaptureFailed(true)
                                })
                            }
                        }}
                        onSeeked={function () {
                            if (FEATURE_CAPTURE_SEEK_SEC > 0 && !captureReady) {
                                setCaptureReady(true)
                            }
                        }}
                        onPlaying={function () {
                            setCaptureReady(true)
                        }}
                        onError={function () {
                            setCaptureFailed(true)
                        }}
                    >
                        <source src={video} type="video/webm" />
                    </video>
                ) : null}
                <div
                    className={
                        'feature-showcase__motion ' +
                        (showMotion
                            ? 'feature-showcase__motion--visible'
                            : 'feature-showcase__motion--hidden')
                    }
                    aria-hidden={showCapture}
                >
                    <div
                        className="feature-showcase__fade feature-showcase__fade--bottom"
                        aria-hidden="true"
                    />
                    <div
                        className={
                            'feature-showcase__camera ' +
                            (showMotion ? 'feature-showcase__camera--live' : '')
                        }
                    >
                        <div className="feature-showcase__window">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <figcaption className="feature-showcase__caption">
                {label}
            </figcaption>
        </figure>
    )
}
