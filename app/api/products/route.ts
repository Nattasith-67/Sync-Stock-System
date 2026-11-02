import { connection, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  await connection();
  try {
    const products = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        mappings: {
          include: {
            shop: {
              select: {
                id: true,
                platform: true,
                platformShopId: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to load products:", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid product payload" }, { status: 400 });
  }

  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const stock = Number(body.stock);
  if (
    !sku ||
    !name ||
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    return NextResponse.json(
      { error: "SKU, product name, and a non-negative integer stock are required" },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.create({
      data: { sku, name, stock },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "This SKU already exists" },
        { status: 409 },
      );
    }
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    isRecord(error) &&
    "code" in error &&
    error.code === "P2002"
  );
}
