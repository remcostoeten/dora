import { NextResponse } from 'next/server'
import {
    OAuthConfigError,
    SUPABASE_AUTHORIZE_URL,
    challengeFromVerifier,
    encodeState,
    getConfig,
    isLoopbackUrl,
    randomVerifier
} from '../_lib'
import { getPostHogClient } from '@/lib/posthog-server'

// Desktop entry point. The app opens this URL in the system browser with its
// loopback callback as `redirect_uri`. We mint PKCE + an encrypted state blob
// (carrying the verifier and the loopback URL), then 302 to Supabase's consent
// screen. Nothing is persisted server-side — the proxy stays stateless.

export async function GET(request: Request) {
    let config
    try {
        config = getConfig(request.url)
    } catch (error) {
        const status = error instanceof OAuthConfigError ? 503 : 500
        return NextResponse.json(
            { error: (error as Error).message },
            { status }
        )
    }

    const url = new URL(request.url)
    const loopback = url.searchParams.get('redirect_uri')
    if (!loopback || !isLoopbackUrl(loopback)) {
        return NextResponse.json(
            {
                error: 'A loopback redirect_uri (http://127.0.0.1:PORT/...) is required.'
            },
            { status: 400 }
        )
    }

    const verifier = randomVerifier()
    const challenge = await challengeFromVerifier(verifier)
    const state = await encodeState(
        { v: verifier, r: loopback, t: Math.floor(Date.now() / 1000) },
        config.stateSecret
    )

    const authorize = new URL(SUPABASE_AUTHORIZE_URL)
    authorize.searchParams.set('client_id', config.clientId)
    authorize.searchParams.set('redirect_uri', config.callbackUrl)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('code_challenge', challenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    const scopes = process.env.SUPABASE_OAUTH_SCOPES
    if (scopes) authorize.searchParams.set('scope', scopes)

    getPostHogClient().capture({
        distinctId: 'anonymous',
        event: 'supabase_oauth_started',
        properties: { provider: 'supabase' }
    })

    return NextResponse.redirect(authorize.toString())
}
