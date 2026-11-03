import { NextResponse } from "next/server";
import { getLazadaAuthorizationUrl } from "@/app/lib/lazada";
import { env } from "@/app/lib/env";

const STATE_COOKIE = "lazada-oauth-state";

export async function GET(request: Request) {
  const appKey = env.LAZADA_APP_KEY;
  const url = new URL(request.url);
  const redirectUri =
    env.LAZADA_REDIRECT_URI ??
    (env.NODE_ENV === "production"
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL || "syncstock-six.vercel.app"}/api/auth/callback`
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
  const response = NextResponse.redirect(
    getLazadaAuthorizationUrl(appKey, callbackUrl.toString(), state),
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
