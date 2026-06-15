import { describe, expect, it } from 'vitest'
import {
	challengeFromVerifier,
	decodeState,
	encodeState,
	isLoopbackUrl,
	randomVerifier,
	type StatePayload,
} from '../apps/marketing/src/app/api/oauth/supabase/_lib'

const SECRET = 'test-state-secret-test-state-secret'

function payload(overrides: Partial<StatePayload> = {}): StatePayload {
	return {
		v: randomVerifier(),
		r: 'http://127.0.0.1:54321/callback',
		t: Math.floor(Date.now() / 1000),
		...overrides,
	}
}

describe('encodeState / decodeState', function () {
	it('round-trips the verifier and loopback URL', async function () {
		const original = payload()
		const token = await encodeState(original, SECRET)
		const decoded = await decodeState(token, SECRET)
		expect(decoded.v).toBe(original.v)
		expect(decoded.r).toBe(original.r)
	})

	it('rejects a state encrypted with a different secret', async function () {
		const token = await encodeState(payload(), SECRET)
		await expect(decodeState(token, 'a-different-secret-value-entirely')).rejects.toThrow(
			/tampered/i
		)
	})

	it('rejects an expired state', async function () {
		const stale = payload({ t: Math.floor(Date.now() / 1000) - 4000 })
		const token = await encodeState(stale, SECRET)
		await expect(decodeState(token, SECRET)).rejects.toThrow(/expired/i)
	})
})

describe('isLoopbackUrl', function () {
	it('accepts loopback http URLs', function () {
		expect(isLoopbackUrl('http://127.0.0.1:1234/callback')).toBe(true)
		expect(isLoopbackUrl('http://localhost:9999/callback')).toBe(true)
	})

	it('rejects non-loopback and https URLs (prevents token exfiltration)', function () {
		expect(isLoopbackUrl('https://evil.example.com/callback')).toBe(false)
		expect(isLoopbackUrl('http://10.0.0.5/callback')).toBe(false)
		expect(isLoopbackUrl('not a url')).toBe(false)
	})
})

describe('challengeFromVerifier (PKCE S256)', function () {
	it('matches the RFC 7636 test vector', async function () {
		// From RFC 7636 Appendix B.
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
		const challenge = await challengeFromVerifier(verifier)
		expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
	})
})
