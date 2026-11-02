import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { updateLazadaStock } from "@/app/lib/lazada";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (body.code !== 3) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const data = body.data;
  if (!isRecord(data) || !Array.isArray(data.items)) {
    return NextResponse.json(
      { error: "Order webhook must include data.items" },
      { status: 400 },
    );
  }

  const shopId =
    typeof body.shop_id === "string" || typeof body.shop_id === "number"
      ? String(body.shop_id)
      : undefined;

  try {
    for (const item of data.items) {
      if (!isRecord(item)) {
        return NextResponse.json({ error: "Invalid order item" }, { status: 400 });
      }

      const itemId = item.item_id;
      const quantity = Number(item.model_quantity_purchased);
      if (
        (typeof itemId !== "string" && typeof itemId !== "number") ||
        !String(itemId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return NextResponse.json(
          { error: "Each item must include item_id and a positive purchased quantity" },
          { status: 400 },
        );
      }

      const mapping = await prisma.productMapping.findFirst({
        where: {
          platformId: String(itemId),
          shop: {
            platform: "SHOPEE",
            ...(shopId ? { platformShopId: shopId } : {}),
          },
        },
      });

      if (!mapping) continue;

      const lazadaMapping = await prisma.productMapping.findFirst({
        where: {
          productId: mapping.productId,
          shop: { platform: "LAZADA" },
        },
        include: { shop: true },
      });

      const lazadaAppKey = process.env.LAZADA_APP_KEY;
      const lazadaAppSecret = process.env.LAZADA_APP_SECRET;
      if (lazadaMapping && (!lazadaAppKey || !lazadaAppSecret)) {
        throw new Error("LAZADA_APP_KEY and LAZADA_APP_SECRET must be configured");
      }

      const newStock = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.product.updateMany({
          where: {
            id: mapping.productId,
            stock: { gte: quantity },
          },
          data: { stock: { decrement: quantity } },
        });

        if (updated.count !== 1) {
          throw new Error("Insufficient stock or product no longer exists");
        }

        const product = await transaction.product.findUniqueOrThrow({
          where: { id: mapping.productId },
          select: { stock: true },
        });
        return product.stock;
      });

      if (lazadaMapping && lazadaAppKey && lazadaAppSecret) {
        await updateLazadaStock({
          appKey: lazadaAppKey,
          appSecret: lazadaAppSecret,
          accessToken: lazadaMapping.shop.accessToken,
          sellerSku: lazadaMapping.platformSku,
          quantity: newStock,
        });
      }

      await prisma.syncLog.create({
        data: {
          platform: "SHOPEE",
          event: "ORDER_CREATED",
          payload: JSON.stringify(body),
          status: "SUCCESS",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopee Webhook Error:", error);
    return NextResponse.json(
      { error: "Failed to process Shopee webhook" },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}