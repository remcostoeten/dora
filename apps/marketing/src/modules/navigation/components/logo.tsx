import { site } from '@/shared/config/docs-site'

export function Logo() {
    const { logo } = site
    if (!logo) return null

    return (
        <img
            src={logo.src}
            alt={logo.hideName ? (logo.alt ?? site.name) : ''}
            width={logo.width}
            height={logo.height}
            className="shrink-0"
            draggable={false}
        />
    )
}
