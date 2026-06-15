// Shared helpers for the Supabase Management-API OAuth proxy.
//
// Why this proxy exists: Supabase's Management API OAuth is a *confidential*
// client — the token exchange at POST /v1/oauth/token authenticates with a
// client_secret (HTTP Basic), even when PKCE is used. A distributed desktop app
// cannot embed that secret, so these route handlers hold it (as a Vercel env
// var) and perform only the secret-requiring steps: the initial code exchange
// and refresh. The resulting tokens are handed back to the desktop app, which
// then calls api.supabase.com directly — user project data never flows through
// here.

export const SUPABASE_AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
export const SUPABASE_TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

// How long a signed `state` blob stays valid (authorize round-trip). Generous
// enough for a human to approve in the browser, short enough to limit replay.
const STATE_TTL_SECONDS = 600;

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** The redirect URI registered on the Supabase OAuth app (this proxy's callback). */
  callbackUrl: string;
  /** Secret used to encrypt + authenticate the `state` blob. */
  stateSecret: string;
};

export function getConfig(requestUrl: string): OAuthConfig {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  const stateSecret = process.env.OAUTH_STATE_SECRET;

  if (!clientId || !clientSecret || !stateSecret) {
    throw new OAuthConfigError(
      "Supabase OAuth is not configured. Set SUPABASE_OAUTH_CLIENT_ID, SUPABASE_OAUTH_CLIENT_SECRET and OAUTH_STATE_SECRET.",
    );
  }

  // The callback must exactly match the redirect URI registered on the Supabase
  // OAuth app. Derive it from the incoming request origin (or override) so the
  // same code works in preview, production, and local dev.
  const origin = process.env.OAUTH_CALLBACK_ORIGIN ?? new URL(requestUrl).origin;
  const callbackUrl = `${origin}/api/oauth/supabase/callback`;

  return { clientId, clientSecret, callbackUrl, stateSecret };
}

export class OAuthConfigError extends Error {}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of view) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

// ---------------------------------------------------------------------------
// State: AES-256-GCM authenticated encryption.
//
// The state carries the PKCE code_verifier and the desktop loopback return URL
// through the browser and Supabase, then back to /callback. Encrypting (not just
// signing) keeps the code_verifier and the user's loopback port out of browser
// history and referrer logs.
// ---------------------------------------------------------------------------

export type StatePayload = {
  /** PKCE code verifier generated in /start. */
  v: string;
  /** Desktop loopback URL to redirect tokens back to, e.g. http://127.0.0.1:PORT/callback. */
  r: string;
  /** Issued-at epoch seconds, for TTL enforcement. */
  t: number;
};

async function stateKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encodeState(payload: StatePayload, secret: string): Promise<string> {
  const key = await stateKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return base64url(combined);
}

export async function decodeState(token: string, secret: string): Promise<StatePayload> {
  const bytes = Uint8Array.from(
    atob(token.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const key = await stateKey(secret);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch {
    throw new Error("Invalid or tampered OAuth state.");
  }
  const payload = JSON.parse(new TextDecoder().decode(plaintext)) as StatePayload;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.t || now - payload.t > STATE_TTL_SECONDS) {
    throw new Error("OAuth state has expired. Please start the connection again.");
  }
  return payload;
}

// Only allow loopback return URLs so a forged `state` can't redirect tokens to
// an attacker-controlled host. (state is encrypted, but defense in depth.)
export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Token exchange (confidential client — Basic auth with the secret)
// ---------------------------------------------------------------------------

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
};

export type DesktopTokens = {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry, epoch seconds. */
  expiresAt: number;
};

async function postToken(config: OAuthConfig, body: URLSearchParams): Promise<DesktopTokens> {
  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const response = await fetch(SUPABASE_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase token endpoint returned ${response.status}: ${detail}`);
  }

  const json = (await response.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 0),
  };
}

export function exchangeCode(
  config: OAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<DesktopTokens> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
      code_verifier: codeVerifier,
    }),
  );
}

export function refreshTokens(config: OAuthConfig, refreshToken: string): Promise<DesktopTokens> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
