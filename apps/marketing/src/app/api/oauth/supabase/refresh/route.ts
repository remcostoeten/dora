import { NextResponse } from "next/server";
import { OAuthConfigError, getConfig, refreshTokens } from "../_lib";

// The desktop app calls this when its access token is near expiry. Refresh also
// requires the client secret, so it must run here rather than on-device.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let config;
  try {
    config = getConfig(request.url);
  } catch (error) {
    const status = error instanceof OAuthConfigError ? 503 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  let refreshToken: string | undefined;
  try {
    const body = (await request.json()) as { refreshToken?: string };
    refreshToken = body.refreshToken;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refreshToken." }, { status: 400 });
  }

  try {
    const tokens = await refreshTokens(config, refreshToken);
    return NextResponse.json(tokens);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
