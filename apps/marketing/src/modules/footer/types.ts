import type { ComponentType } from 'react'
import type { IconName } from '@/shared/icons/icons'
import type { IconProps } from '@/shared/icons/glyph'

export type FooterIcon = IconName | ComponentType<IconProps>

export type FooterLink = {
    label: string
    href: string
    external?: boolean
    icon?: FooterIcon
}

export type FooterColumn = {
    title: string
    links: FooterLink[]
}

export type FooterBrand = {
    name?: string
    description?: string
}

export type FooterBottom = {
    copyright?: string
    links?: FooterLink[]
}

export type FooterConfig = {
    enabled?: boolean
    hideOn?: string[]
    brand?: true | FooterBrand
    columns: FooterColumn[]
    bottom?: FooterBottom
}
