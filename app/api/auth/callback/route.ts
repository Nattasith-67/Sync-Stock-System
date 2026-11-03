import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeLazadaAuthCode } from "@/app/lib/lazada";
import { prisma } from "@/app/lib/prisma";
import { env } from "@/app/lib/env";

const STATE_COOKIE = "lazada-oauth-state";

type OAuthFailureReason =
  | "authorization"
  | "invalid_state"
  | "missing_code"
  | "token_exchange"
  | "seller_info"
  | "database";

function redirectToOAuthError(
  request: NextRequest,
  reason: OAuthFailureReason,
) {
  const response = NextResponse.redirect(
    new URL(`/?lazada=error&reason=${reason}`, request.url),
  );
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const authorizationError = searchParams.get("error");
  if (authorizationError) {
    console.warn("Lazada authorization was rejected", {
      error: authorizationError,
    });
    return redirectToOAuthError(request, "authorization");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const receivedState = searchParams.get("state");
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    console.warn("Lazada OAuth state validation failed", {
      hasExpectedState: Boolean(expectedState),
      hasReceivedState: Boolean(receivedState),
      statesMatch: Boolean(expectedState && receivedState === expectedState),
    });
    return redirectToOAuthError(request, "invalid_state");
  }

  const code = searchParams.get("code");
  if (!code) {
    console.warn("Lazada OAuth callback did not include an authorization code");
    return redirectToOAuthError(request, "missing_code");
  }

  let failureStage: OAuthFailureReason = "token_exchange";
  try {
    const token = await exchangeLazadaAuthCode({
      appKey: env.LAZADA_APP_KEY,
      appSecret: env.LAZADA_APP_SECRET,
      code,
    });
    failureStage = "seller_info";
    const sellerInfo = token.country_user_info?.[0];
    if (!sellerInfo) {
      throw new Error("Lazada token response is missing seller information");
    }
    const platformShopId = String(sellerInfo.seller_id ?? sellerInfo.user_id);
    if (platformShopId === "undefined") {
      throw new Error("Lazada token response is missing the seller ID");
    }
    const expiresIn = Number(token.expires_in);

    failureStage = "database";
    await prisma.shop.upsert({
      where: {
        platform_platformShopId: {
          platform: "LAZADA",
          platformShopId,
        },
      },
      create: {
        platform: "LAZADA",
        platformShopId,
        name: sellerInfo.name ?? null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        tokenExpiresAt:
          Number.isFinite(expiresIn) && expiresIn > 0
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
      },
      update: {
        accessToken: token.access_token,
        ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
        tokenExpiresAt:
          Number.isFinite(expiresIn) && expiresIn > 0
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
      },
    });

    const response = NextResponse.redirect(
      new URL("/?lazada=connected", request.url),
    );
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error(`Lazada OAuth ${failureStage} failed:`, error);
    return redirectToOAuthError(request, failureStage);
  }
}
