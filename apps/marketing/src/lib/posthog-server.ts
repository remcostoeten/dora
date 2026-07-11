import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog {
    if (!posthogClient) {
        posthogClient = new PostHog(
            process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
            {
                host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                flushAt: 1,
                flushInterval: 0
            }
        )
    }
    return posthogClient
}

type THogqlResult = {
    columns: string[]
    types: (string | null)[]
    rows: unknown[][]
}

/**
 * Runs a read-only HogQL query against this project's own PostHog data via
 * the Query API. Requires POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY
 * (a personal API key with query:read scope) — returns null when either is
 * unset or the request fails, so callers can fall back to static content.
 */
export async function queryHogql(hogql: string): Promise<THogqlResult | null> {
    const projectId = process.env.POSTHOG_PROJECT_ID
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!projectId || !apiKey || !host) return null

    try {
        const response = await fetch(
            `${host}/api/projects/${projectId}/query/`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: { kind: 'HogQLQuery', query: hogql }
                }),
                next: { revalidate: 3600 }
            }
        )
        if (!response.ok) return null

        const data = (await response.json()) as {
            columns?: string[]
            types?: (string | null)[]
            results?: unknown[][]
        }
        return {
            columns: data.columns ?? [],
            types: data.types ?? [],
            rows: data.results ?? []
        }
    } catch {
        return null
    }
}
