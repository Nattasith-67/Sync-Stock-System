import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { syncLazadaStock, writeSyncLog } from "@/app/lib/lazada-sync";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid product payload" }, { status: 400 });
  }

  const data: { name?: string; stock?: number } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return NextResponse.json(
        { error: "Stock must be a non-negative integer" },
        { status: 400 },
      );
    }
    data.stock = stock;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data,
      include: { mappings: true },
    });
    const stockSync = data.stock === undefined
      ? null
      : await syncMappedLazadaStock(product.mappings.map((mapping) => mapping.shopId));
    return NextResponse.json({ product, stockSync });
  } catch (error) {
    if (isRecord(error) && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("Failed to update product:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update product" },
      { status: 500 },
    );
  }
}

async function syncMappedLazadaStock(shopIds: string[]) {
  const shops = await prisma.shop.findMany({
    where: { id: { in: shopIds }, platform: "LAZADA" },
  });
  const results = [];
  for (const shop of shops) {
    try {
      results.push(await syncLazadaStock(shop));
    } catch (error) {
      await writeSyncLog("STOCK_SYNCED", "FAILED", {
        shopId: shop.platformShopId,
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
      results.push({
        total: 0,
        synced: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : "Unknown sync error"],
      });
    }
  }
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
