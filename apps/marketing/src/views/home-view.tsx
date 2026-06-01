import {
    organizationSchema,
    softwareSchema,
    websiteSchema
} from '@/core/config/structured-data'
import { FeaturesSection } from '@/components/features-section'
import { GitHubStats as GitStats } from '@/components/github-stats'
import { Hero } from '@/components/hero'
import { getGitHubStats } from '@/core/github/get-github-stats'

export default async function HomeView() {
    // Fetched on the server so the stats land in the initial HTML (SEO + no
    // client waterfall). ISR-cached via the per-fetch revalidate windows.
    const stats = await getGitHubStats()

    return (
        <>
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
            <Hero />
            <FeaturesSection />
            {stats ? <GitStats data={stats} /> : null}
        </>
    )
}
