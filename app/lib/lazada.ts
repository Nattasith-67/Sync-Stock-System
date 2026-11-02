import crypto from "node:crypto";

const LAZADA_HOST = "https://api.lazada.co.th/rest";
const LAZADA_AUTH_URL = "https://auth.lazada.com/oauth/authorize";

export interface LazadaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: string | number;
  country_user_info?: LazadaSellerInfo[];
}

export interface LazadaSellerInfo {
  seller_id?: string | number;
  user_id?: string | number;
  short_code?: string;
  country?: string;
  name?: string;
}

export interface LazadaSku {
  SkuId?: string | number;
  SellerSku?: string;
  quantity?: string | number;
}

export interface LazadaProduct {
  item_id?: string | number;
  attributes?: { name?: string };
  skus?: LazadaSku[];
}

export interface LazadaOrder {
  order_id?: string | number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export function getLazadaAuthorizationUrl(
  appKey: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    force_auth: "true",
    client_id: appKey,
    redirect_uri: redirectUri,
    state,
  });
  return `${LAZADA_AUTH_URL}?${params}`;
}

export async function exchangeLazadaAuthCode({
  appKey,
  appSecret,
  code,
}: {
  appKey: string;
  appSecret: string;
  code: string;
}): Promise<LazadaTokenResponse> {
  const result = await requestLazadaToken(
    appKey,
    appSecret,
    "/auth/token/create",
    { code },
  );
  if (!result.country_user_info?.some(isSellerInfo)) {
    throw new Error("Lazada token response is missing seller information");
  }
  return result;
}

export function refreshLazadaAccessToken({
  appKey,
  appSecret,
  refreshToken,
}: {
  appKey: string;
  appSecret: string;
  refreshToken: string;
}): Promise<LazadaTokenResponse> {
  return requestLazadaToken(
    appKey,
    appSecret,
    "/auth/token/refresh",
    { refresh_token: refreshToken },
  );
}

export async function callLazadaApi({
  appKey,
  appSecret,
  accessToken,
  path,
  params = {},
  method = "GET",
}: {
  appKey: string;
  appSecret: string;
  accessToken: string;
  path: string;
  params?: Record<string, string>;
  method?: "GET" | "POST";
}): Promise<unknown> {
  const requestParams = {
    ...params,
    app_key: appKey,
    access_token: accessToken,
    timestamp: Date.now().toString(),
    sign_method: "sha256",
  };
  const query = new URLSearchParams({
    ...requestParams,
    sign: generateLazadaSign(appSecret, path, requestParams),
  });
  const response = await fetch(`${LAZADA_HOST}${path}`, {
    method,
    ...(method === "POST"
      ? {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
          body: query.toString(),
        }
      : { headers: { Accept: "application/json" }, cache: "no-store" }),
  });
  return parseLazadaResponse(response, path);
}

export async function updateLazadaStock({
  appKey,
  appSecret,
  accessToken,
  sellerSku,
  quantity,
}: {
  appKey: string;
  appSecret: string;
  accessToken: string;
  sellerSku: string;
  quantity: number;
}): Promise<void> {
  const escapeXml = (value: string) =>
    value.replace(/[<>&'"]/g, (character) => {
      const entities: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      };
      return entities[character];
    });
  const payload = `<Request><Product><Skus><Sku><SellerSku>${escapeXml(sellerSku)}</SellerSku><Quantity>${quantity}</Quantity></Sku></Skus></Product></Request>`;
  await callLazadaApi({
    appKey,
    appSecret,
    accessToken,
    path: "/product/price_quantity/update",
    params: { payload },
    method: "POST",
  });
}

async function requestLazadaToken(
  appKey: string,
  appSecret: string,
  path: string,
  params: Record<string, string>,
): Promise<LazadaTokenResponse> {
  const requestParams = {
    ...params,
    app_key: appKey,
    timestamp: Date.now().toString(),
    sign_method: "sha256",
  };
  const query = new URLSearchParams({
    ...requestParams,
    sign: generateLazadaSign(appSecret, path, requestParams),
  });
  const response = await fetch(`${LAZADA_HOST}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: query.toString(),
    cache: "no-store",
  });
  const result = await parseLazadaResponse(response, path);
  if (!isRecord(result) || !isRecord(result.data)) {
    throw new Error(`Lazada ${path} response is missing token data`);
  }
  const data = result.data;
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error(`Lazada ${path} response is missing an access token`);
  }
  if (
    data.refresh_token !== undefined &&
    typeof data.refresh_token !== "string"
  ) {
    throw new Error(`Lazada ${path} response contains an invalid refresh token`);
  }
  if (
    data.expires_in !== undefined &&
    typeof data.expires_in !== "string" &&
    typeof data.expires_in !== "number"
  ) {
    throw new Error(`Lazada ${path} response contains an invalid expiry`);
  }
  if (
    data.country_user_info !== undefined &&
    (!Array.isArray(data.country_user_info) ||
      !data.country_user_info.every(isSellerInfo))
  ) {
    throw new Error(`Lazada ${path} response contains invalid seller information`);
  }
  return {
    access_token: data.access_token,
    ...(typeof data.refresh_token === "string"
      ? { refresh_token: data.refresh_token }
      : {}),
    ...(typeof data.expires_in === "string" ||
    typeof data.expires_in === "number"
      ? { expires_in: data.expires_in }
      : {}),
    ...(Array.isArray(data.country_user_info)
      ? { country_user_info: data.country_user_info }
      : {}),
  };
}

async function parseLazadaResponse(
  response: Response,
  path: string,
): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Lazada ${path} request failed with status ${response.status}`);
  }
  const result: unknown = await response.json();
  if (!isRecord(result) || result.code !== "0") {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Invalid API response";
    throw new Error(`Lazada ${path} failed: ${message}`);
  }
  return result;
}

function generateLazadaSign(
  appSecret: string,
  apiPath: string,
  params: Record<string, string>,
): string {
  const baseString =
    apiPath +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");
  return crypto
    .createHmac("sha256", appSecret)
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSellerInfo(value: unknown): value is LazadaSellerInfo {
  return (
    isRecord(value) &&
    (typeof value.seller_id === "string" ||
      typeof value.seller_id === "number" ||
      typeof value.user_id === "string" ||
      typeof value.user_id === "number")
  );
}
