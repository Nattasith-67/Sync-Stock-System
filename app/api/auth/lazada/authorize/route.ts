import { NextResponse } from "next/server";
import { getLazadaAuthorizationUrl } from "@/app/lib/lazada";
import { env } from "@/app/lib/env";

const STATE_COOKIE = "lazada-oauth-state";
const DEFAULT_PRODUCTION_REDIRECT_URI =
  "https://sync-stock-system-phi.vercel.app/api/auth/callback";

export async function GET(request: Request) {
  const appKey = env.LAZADA_APP_KEY;
  const url = new URL(request.url);
  const redirectUri =
    env.LAZADA_REDIRECT_URI ??
    (env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_REDIRECT_URI
      : `${url.origin}/api/auth/callback`);

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(redirectUri);
  } catch {
    return NextResponse.json(
      { error: "LAZADA_REDIRECT_URI must be an absolute URL" },
      { status: 500 },
    );
  }
  if (
    !["http:", "https:"].includes(callbackUrl.protocol) ||
    callbackUrl.pathname !== "/api/auth/callback" ||
    callbackUrl.search ||
    callbackUrl.hash
  ) {
    return NextResponse.json(
      {
        error:
          "LAZADA_REDIRECT_URI must exactly match the registered /api/auth/callback URL",
      },
      { status: 400 },
    );
  }

  if (callbackUrl.origin !== url.origin) {
    if (env.NODE_ENV === "production") {
      return NextResponse.redirect(
        new URL("/api/auth/lazada/authorize", callbackUrl.origin),
      );
    }
    return NextResponse.json(
      {
        error:
          "LAZADA_REDIRECT_URI must use the same host as the URL used to open SyncStock",
      },
      { status: 400 },
    );
  }

  const state = crypto.randomUUID();
  const authorizationUrl = getLazadaAuthorizationUrl(
    appKey,
    callbackUrl.toString(),
    state,
  );
  const authorizationParams = new URL(authorizationUrl).searchParams;
  const clientIdMatchesConfiguredKey =
    authorizationParams.get("client_id") === appKey;
  const redirectUriMatchesConfiguredUrl =
    authorizationParams.get("redirect_uri") === callbackUrl.toString();
  console.info("Lazada OAuth parameter check:", {
    clientIdMatchesConfiguredKey,
    clientIdSuffix: appKey.slice(-4),
    redirectUriMatchesConfiguredUrl,
    redirectUri: authorizationParams.get("redirect_uri"),
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/auth/callback",
    maxAge: 600,
  });
  return response;
}