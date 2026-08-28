'use client'

export type TDocMediaAssetProps = {
    src: string
    /** Defaults to 'video'. Pass 'image' for static screenshots. */
    type?: 'video' | 'image'
    /** Poster shown while the video loads. */
    poster?: string
    alt?: string
    caption?: string
    className?: string
}

export function DocMediaAsset({
    src,
    type = 'video',
    poster,
    alt = '',
    caption,
    className = ''
}: TDocMediaAssetProps) {
    const showStatic = type === 'image'

    return (
        <figure
            className={`overflow-hidden border border-line bg-background/30 ${className}`}
        >
            {showStatic ? (
                <img src={src} alt={alt} className="w-full" draggable={false} />
            ) : (
                <video
                    src={src}
                    poster={poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full"
                    aria-label={alt || undefined}
                />
            )}
            {caption ? (
                <figcaption className="border-t border-line px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {caption}
                </figcaption>
            ) : null}
        </figure>
    )
}
