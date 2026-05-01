import { absoluteUrl } from './seo'
import { siteConfig } from './site'

export const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.assets.icon),
    founder: {
        '@type': 'Person',
        name: siteConfig.author.name,
        url: siteConfig.author.url
    }
}

export const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description
}

export const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Windows, Linux',
    description: siteConfig.description,
    author: {
        '@type': 'Person',
        name: siteConfig.author.name
    }
}
