import Link from 'next/link'

import {
    organizationSchema,
    softwareSchema,
    websiteSchema
} from '@/core/config/structured-data'
import { siteConfig } from '@/core/config/site'

export default function HomeView() {
    return (
        <main className="hero">
            <script
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify([
                        organizationSchema,
                        websiteSchema,
                        softwareSchema
                    ])
                }}
                type="application/ld+json"
            />
            <p className="eyebrow">{siteConfig.tagline}</p>
            <h1>{siteConfig.name}</h1>
            <p className="lead">{siteConfig.description}</p>
            <div className="actions">
                <Link className="button" href="/downloads">
                    Download Dora
                </Link>
                <Link className="button secondary" href="/app">
                    Preview app
                </Link>
            </div>
            <section aria-label="Product focus" className="section-grid">
                <article className="tile">
                    <h2>Browse</h2>
                    <p>
                        Move through database tables, rows, and records from a
                        focused desktop surface.
                    </p>
                </article>
                <article className="tile">
                    <h2>Inspect</h2>
                    <p>
                        Keep schema context close while exploring data and
                        switching between work.
                    </p>
                </article>
                <article className="tile">
                    <h2>Ship</h2>
                    <p>
                        Use a lean explorer built around daily database work,
                        not generic dashboards.
                    </p>
                </article>
            </section>
        </main>
    )
}
