import { connection, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  await connection();
  try {
    const mappings = await prisma.productMapping.findMany({
      orderBy: { product: { sku: "asc" } },
      include: {
        product: { select: { id: true, sku: true, name: true, stock: true } },
        shop: {
          select: { id: true, platform: true, platformShopId: true, name: true },
        },
      },
    });
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to load product mappings:", error);
    return NextResponse.json(
      { error: "Failed to load product mappings" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid mapping payload" }, { status: 400 });
  }
  const productId = typeof body.productId === "string" ? body.productId : "";
  const shopId = typeof body.shopId === "string" ? body.shopId : "";
  const platformId = typeof body.platformId === "string" ? body.platformId.trim() : "";
  const platformSku =
    typeof body.platformSku === "string" ? body.platformSku.trim() : "";
  if (!productId || !shopId || !platformId || !platformSku) {
    return NextResponse.json(
      { error: "Product, Lazada shop, platform ID, and seller SKU are required" },
      { status: 400 },
    );
  }

  try {
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, platform: "LAZADA" },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: "Lazada shop not found" }, { status: 404 });
    }
    const mapping = await prisma.productMapping.upsert({
      where: { shopId_platformId: { shopId, platformId } },
      create: { productId, shopId, platformId, platformSku },
      update: { productId, platformSku },
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    if (isRecord(error) && "code" in error && error.code === "P2003") {
      return NextResponse.json(
        { error: "Selected product or shop does not exist" },
        { status: 404 },
      );
    }
    console.error("Failed to save product mapping:", error);
    return NextResponse.json(
      { error: "Failed to save product mapping" },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
