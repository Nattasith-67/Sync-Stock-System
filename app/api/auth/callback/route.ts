import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeLazadaAuthCode } from "@/app/lib/lazada";
import { prisma } from "@/app/lib/prisma";

const STATE_COOKIE = "lazada-oauth-state";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const authorizationError = searchParams.get("error");
  if (authorizationError) {
    return NextResponse.json(
      { error: "Lazada authorization was not completed" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const receivedState = searchParams.get("state");
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    return NextResponse.json(
      { error: "Invalid or expired Lazada authorization state" },
      { status: 400 },
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code from Lazada" },
      { status: 400 },
    );
  }

  const appKey = process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_APP_SECRET;
  if (!appKey || !appSecret) {
    console.error("LAZADA_APP_KEY and LAZADA_APP_SECRET must be configured");
    return NextResponse.json(
      { error: "Lazada integration is not configured" },
      { status: 500 },
    );
  }

  try {
    const token = await exchangeLazadaAuthCode({ appKey, appSecret, code });
    const sellerInfo = token.country_user_info?.[0];
    if (!sellerInfo) {
      throw new Error("Lazada token response is missing seller information");
    }
    const platformShopId = String(sellerInfo.seller_id ?? sellerInfo.user_id);
    if (platformShopId === "undefined") {
      throw new Error("Lazada token response is missing the seller ID");
    }
    const expiresIn = Number(token.expires_in);

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
    console.error("Lazada OAuth callback failed:", error);
    const response = NextResponse.redirect(
      new URL("/?lazada=error", request.url),
    );
    response.cookies.delete(STATE_COOKIE);
    return response;
  }
}
