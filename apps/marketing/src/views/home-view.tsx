import {
    organizationSchema,
    softwareSchema,
    websiteSchema
} from '@/core/config/structured-data'
import { GitHubStats as GitStats } from '@/components/github-stats'
import { Hero } from '@/components/hero'

export default function HomeView() {
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
            <GitStats />
        </>
    )
}
