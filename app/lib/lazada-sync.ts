import { prisma } from "@/app/lib/prisma";
import { env } from "@/app/lib/env";
import {
  callLazadaApi,
  refreshLazadaAccessToken,
  updateLazadaStock,
  type LazadaOrder,
  type LazadaProduct,
} from "@/app/lib/lazada";

const LAZADA_PLATFORM = "LAZADA" as const;
const PAID_STATUSES = new Set(["pending", "ready_to_ship", "shipped", "delivered"]);
const RESTOCK_STATUSES = new Set(["canceled", "cancelled", "returned", "shipped_back"]);

type LazadaShop = {
  id: string;
  platformShopId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

type OrderLine = {
  sku: string;
  quantity: number;
};

export function getLazadaCredentials() {
  return { appKey: env.LAZADA_APP_KEY, appSecret: env.LAZADA_APP_SECRET };
}

async function getAccessToken(shop: LazadaShop): Promise<string> {
  if (
    !shop.tokenExpiresAt ||
    shop.tokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return shop.accessToken;
  }
  if (!shop.refreshToken) {
    throw new Error(`Lazada shop ${shop.platformShopId} needs to be reconnected`);
  }

  const { appKey, appSecret } = getLazadaCredentials();
  const token = await refreshLazadaAccessToken({
    appKey,
    appSecret,
    refreshToken: shop.refreshToken,
  });
  const expiresIn = Number(token.expires_in);
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      tokenExpiresAt:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
    },
  });
  shop.accessToken = token.access_token;
  if (token.refresh_token) shop.refreshToken = token.refresh_token;
  shop.tokenExpiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
  return token.access_token;
}

async function callForShop(
  shop: LazadaShop,
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const { appKey, appSecret } = getLazadaCredentials();
  const accessToken = await getAccessToken(shop);
  return callLazadaApi({
    appKey,
    appSecret,
    accessToken,
    path,
    params,
  });
}

export async function fetchLazadaProducts(
  shop: LazadaShop,
): Promise<LazadaProduct[]> {
  const products: LazadaProduct[] = [];
  const limit = 50;

  for (let offset = 0; offset < 5000; offset += limit) {
    const response = await callForShop(shop, "/products/get", {
      filter: "all",
      limit: String(limit),
      offset: String(offset),
    });
    const data = getData(response);
    if (!isRecord(data) || !Array.isArray(data.products)) {
      throw new Error("Lazada products response is missing data.products");
    }
    const page = data.products.filter(isLazadaProduct);
    if (page.length !== data.products.length) {
      throw new Error("Lazada products response contains an invalid product");
    }
    products.push(...page);
    if (page.length < limit) return products;
  }
  throw new Error("Lazada product list exceeded the 5,000 item safety limit");
}

export async function fetchLazadaOrders(
  shop: LazadaShop,
): Promise<LazadaOrder[]> {
  const orders: LazadaOrder[] = [];
  const limit = 100;
  const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19);

  for (let offset = 0; offset < 5000; offset += limit) {
    const response = await callForShop(shop, "/orders/get", {
      created_after: createdAfter,
      limit: String(limit),
      offset: String(offset),
    });
    const data = getData(response);
    if (!isRecord(data) || !Array.isArray(data.orders)) {
      throw new Error("Lazada orders response is missing data.orders");
    }
    const page = data.orders.filter(isLazadaOrder);
    if (page.length !== data.orders.length) {
      throw new Error("Lazada orders response contains an invalid order");
    }
    orders.push(...page);
    if (page.length < limit) return orders;
  }
  throw new Error("Lazada order list exceeded the 5,000 item safety limit");
}

async function fetchOrderLines(
  shop: LazadaShop,
  orderId: string,
): Promise<OrderLine[]> {
  const response = await callForShop(shop, "/order/items/get", {
    order_id: orderId,
  });
  const data = getData(response);
  const rawItems = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.order_items)
      ? data.order_items
      : null;
  if (!rawItems) {
    throw new Error(`Lazada order ${orderId} response is missing order items`);
  }
  return rawItems.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Lazada order ${orderId} has an invalid item at ${index}`);
    }
    const sku = [item.shop_sku, item.seller_sku, item.sku].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    const quantity = Number(item.quantity);
    if (!sku || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error(`Lazada order ${orderId} has an invalid item at ${index}`);
    }
    return { sku, quantity };
  });
}

export async function syncLazadaProducts(shop: LazadaShop) {
  const products = await fetchLazadaProducts(shop);
  let mappedSkus = 0;
  let skippedSkus = 0;

  for (const product of products) {
    if (!Array.isArray(product.skus)) continue;
    const name =
      typeof product.attributes?.name === "string" &&
      product.attributes.name.trim()
        ? product.attributes.name.trim()
        : "Lazada product";

    for (const sku of product.skus) {
      const platformId =
        typeof sku.SkuId === "string" || typeof sku.SkuId === "number"
          ? String(sku.SkuId)
          : "";
      const sellerSku =
        typeof sku.SellerSku === "string" ? sku.SellerSku.trim() : "";
      const quantity = Number(sku.quantity);
      if (
        !platformId ||
        !sellerSku ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0
      ) {
        skippedSkus += 1;
        continue;
      }

      const inventory = await prisma.product.upsert({
        where: { sku: sellerSku },
        create: { sku: sellerSku, name, stock: quantity },
        update: { name },
        select: { id: true },
      });
      await prisma.productMapping.upsert({
        where: {
          shopId_platformId: {
            shopId: shop.id,
            platformId,
          },
        },
        create: {
          productId: inventory.id,
          shopId: shop.id,
          platformId,
          platformSku: sellerSku,
        },
        update: {
          productId: inventory.id,
          platformSku: sellerSku,
        },
      });
      mappedSkus += 1;
    }
  }

  await writeSyncLog(
    "PRODUCTS_IMPORTED",
    skippedSkus ? "PARTIAL" : "SUCCESS",
    { shopId: shop.platformShopId, products: products.length, mappedSkus, skippedSkus },
  );
  return { products: products.length, mappedSkus, skippedSkus };
}

export async function syncLazadaOrders(shop: LazadaShop) {
  const orders = await fetchLazadaOrders(shop);
  let processed = 0;
  let waitingForPayment = 0;
  let failed = 0;

  for (const order of orders) {
    if (order.order_id === undefined || !order.status) {
      failed += 1;
      continue;
    }
    const platformOrderId = String(order.order_id);
    const status = order.status.toLowerCase();

    try {
      const lines = await fetchOrderLines(shop, platformOrderId);
      if (!lines.length) {
        throw new Error(`Lazada order ${platformOrderId} has no items`);
      }
      const isPaid = PAID_STATUSES.has(status);
      const savedOrder = await prisma.marketplaceOrder.upsert({
        where: {
          shopId_platformOrderId: {
            shopId: shop.id,
            platformOrderId,
          },
        },
        create: {
          shopId: shop.id,
          platformOrderId,
          status,
          isPaid,
          itemsPayload: JSON.stringify(lines),
          payload: JSON.stringify(order),
        },
        update: {
          status,
          isPaid,
          itemsPayload: JSON.stringify(lines),
          payload: JSON.stringify(order),
        },
      });

      if (isPaid && !savedOrder.stockDeducted) {
        await prisma.$transaction(async (transaction) => {
          const claim = await transaction.marketplaceOrder.updateMany({
            where: { id: savedOrder.id, stockDeducted: false },
            data: { isPaid: true, status },
          });
          if (claim.count === 0) return;

          for (const line of lines) {
            const mapping = await transaction.productMapping.findFirst({
              where: {
                shopId: shop.id,
                platformSku: line.sku,
              },
              select: { productId: true },
            });
            if (!mapping) {
              throw new Error(`No inventory mapping found for Lazada SKU ${line.sku}`);
            }
            const update = await transaction.product.updateMany({
              where: {
                id: mapping.productId,
                stock: { gte: line.quantity },
              },
              data: { stock: { decrement: line.quantity } },
            });
            if (update.count !== 1) {
              throw new Error(
                `Insufficient stock for Lazada SKU ${line.sku} in order ${platformOrderId}`,
              );
            }
          }
          await transaction.marketplaceOrder.update({
            where: { id: savedOrder.id },
            data: { stockDeducted: true },
          });
        });
      } else if (RESTOCK_STATUSES.has(status) && savedOrder.stockDeducted) {
        await restoreCanceledOrder(shop, savedOrder.id, lines);
      }

      if (!isPaid && !RESTOCK_STATUSES.has(status)) waitingForPayment += 1;
      processed += 1;
    } catch (error) {
      failed += 1;
      await writeSyncLog("ORDER_PROCESSING_FAILED", "FAILED", {
        shopId: shop.platformShopId,
        orderId: platformOrderId,
        error: error instanceof Error ? error.message : "Unknown order error",
      });
    }
  }

  await writeSyncLog("ORDERS_SYNCED", failed ? "PARTIAL" : "SUCCESS", {
    shopId: shop.platformShopId,
    fetched: orders.length,
    processed,
    waitingForPayment,
    failed,
  });
  return { fetched: orders.length, processed, waitingForPayment, failed };
}

async function restoreCanceledOrder(
  shop: LazadaShop,
  orderId: string,
  lines: OrderLine[],
) {
  const savedOrder = await prisma.marketplaceOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true },
  });
  await prisma.$transaction(async (transaction) => {
    const claim = await transaction.marketplaceOrder.updateMany({
      where: { id: savedOrder.id, stockDeducted: true, stockRestored: false },
      data: { stockRestored: true },
    });
    if (claim.count === 0) return;

    for (const line of lines) {
      const mapping = await transaction.productMapping.findFirst({
        where: { shopId: shop.id, platformSku: line.sku },
        select: { productId: true },
      });
      if (!mapping) {
        throw new Error(`No inventory mapping found for canceled Lazada SKU ${line.sku}`);
      }
      await transaction.product.update({
        where: { id: mapping.productId },
        data: { stock: { increment: line.quantity } },
      });
    }
  });
}

export async function syncLazadaStock(shop: LazadaShop) {
  const { appKey, appSecret } = getLazadaCredentials();
  const accessToken = await getAccessToken(shop);
  const mappings = await prisma.productMapping.findMany({
    where: { shopId: shop.id },
    include: { product: { select: { stock: true } } },
  });
  let synced = 0;
  const errors: string[] = [];

  for (const mapping of mappings) {
    try {
      await updateLazadaStock({
        appKey,
        appSecret,
        accessToken,
        sellerSku: mapping.platformSku,
        quantity: mapping.product.stock,
      });
      synced += 1;
    } catch (error) {
      errors.push(
        `${mapping.platformSku}: ${
          error instanceof Error ? error.message : "Unknown Lazada error"
        }`,
      );
    }
  }

  await writeSyncLog(
    "STOCK_SYNCED",
    errors.length ? (synced ? "PARTIAL" : "FAILED") : "SUCCESS",
    { shopId: shop.platformShopId, total: mappings.length, synced, errors },
  );
  return { total: mappings.length, synced, failed: errors.length, errors };
}

export async function writeSyncLog(
  event: string,
  status: string,
  details: unknown,
) {
  await prisma.syncLog.create({
    data: {
      platform: LAZADA_PLATFORM,
      event,
      status,
      payload: JSON.stringify(details),
    },
  });
}

function getData(value: unknown): unknown {
  if (!isRecord(value) || value.data === undefined) {
    throw new Error("Lazada API response is missing data");
  }
  return value.data;
}

function isLazadaProduct(value: unknown): value is LazadaProduct {
  return (
    isRecord(value) &&
    (value.skus === undefined ||
      (Array.isArray(value.skus) && value.skus.every(isLazadaSku)))
  );
}

function isLazadaOrder(value: unknown): value is LazadaOrder {
  return (
    isRecord(value) &&
    (typeof value.order_id === "string" || typeof value.order_id === "number") &&
    typeof value.status === "string"
  );
}

function isLazadaSku(value: unknown): value is NonNullable<LazadaProduct["skus"]>[number] {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
