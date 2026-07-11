import { NextResponse } from 'next/server'
import {
    OAuthConfigError,
    decodeState,
    exchangeCode,
    getConfig,
    isLoopbackUrl
} from '../_lib'
import { getPostHogClient } from '@/lib/posthog-server'

// Supabase redirects here after the user approves. We decrypt the state to
// recover the PKCE verifier and the desktop loopback URL, exchange the code for
// tokens (using the client secret), then bounce the browser back to the desktop
// app's loopback listener with the tokens. The tokens land on the user's own
// machine and are never stored by the proxy.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(message: string, status = 400): NextResponse {
    return new NextResponse(errorPage(message), {
        status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
}

export async function GET(request: Request) {
    const url = new URL(request.url)

    const supabaseError = url.searchParams.get('error')
    if (supabaseError) {
        const desc = url.searchParams.get('error_description') ?? supabaseError
        getPostHogClient().capture({
            distinctId: 'anonymous',
            event: 'supabase_oauth_failed',
            properties: { provider: 'supabase', reason: supabaseError }
        })
        return fail(`Supabase denied the authorization: ${desc}`)
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) {
        return fail('Missing authorization code or state.')
    }

    let config
    try {
        config = getConfig(request.url)
    } catch (error) {
        const status = error instanceof OAuthConfigError ? 503 : 500
        return fail((error as Error).message, status)
    }

    let payload
    try {
        payload = await decodeState(state, config.stateSecret)
    } catch (error) {
        return fail((error as Error).message)
    }

    if (!isLoopbackUrl(payload.r)) {
        return fail('Refusing to redirect tokens to a non-loopback address.')
    }

    let tokens
    try {
        tokens = await exchangeCode(config, code, payload.v)
    } catch (error) {
        getPostHogClient().capture({
            distinctId: 'anonymous',
            event: 'supabase_oauth_failed',
            properties: {
                provider: 'supabase',
                reason: 'token_exchange_failed'
            }
        })
        return fail(`Token exchange failed: ${(error as Error).message}`, 502)
    }

    getPostHogClient().capture({
        distinctId: 'anonymous',
        event: 'supabase_oauth_completed',
        properties: { provider: 'supabase' }
    })

    // Hand the tokens back to the desktop loopback listener via query params.
    // The redirect target is localhost, so the tokens stay on the user's machine.
    const target = new URL(payload.r)
    target.searchParams.set('access_token', tokens.accessToken)
    target.searchParams.set('refresh_token', tokens.refreshToken)
    target.searchParams.set('expires_at', String(tokens.expiresAt))

    return NextResponse.redirect(target.toString())
}

function errorPage(message: string): string {
    const safe = message.replace(/[<>&]/g, (c) =>
        c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'
    )
    return `<!doctype html><html><head><meta charset="utf-8"><title>Supabase connection failed</title></head><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111"><h1 style="font-size:1.1rem">Couldn't connect Supabase</h1><p style="color:#555">${safe}</p><p style="color:#888;font-size:.85rem">You can close this window and try again from Dora.</p></body></html>`
}
