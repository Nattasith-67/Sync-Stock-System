import { NextResponse } from "next/server";
import { getLazadaAuthorizationUrl } from "@/app/lib/lazada";

const STATE_COOKIE = "lazada-oauth-state";

export async function GET(request: Request) {
  const appKey = process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json(
      { error: "Set LAZADA_APP_KEY and LAZADA_APP_SECRET first" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    getLazadaAuthorizationUrl(appKey, redirectUri, state),
  );
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/auth/callback",
    maxAge: 600,
  });
  return response;
}
