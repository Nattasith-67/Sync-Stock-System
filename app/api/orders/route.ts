import { connection, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  await connection();
  try {
    const orders = await prisma.marketplaceOrder.findMany({
      where: { shop: { platform: "LAZADA" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        platformOrderId: true,
        status: true,
        isPaid: true,
        stockDeducted: true,
        stockRestored: true,
        itemsPayload: true,
        updatedAt: true,
        shop: { select: { platformShopId: true, name: true } },
      },
    });
    return NextResponse.json(
      orders.map(({ itemsPayload, ...order }) => ({
        ...order,
        itemCount: parseItemCount(itemsPayload),
      })),
    );
  } catch (error) {
    console.error("Failed to load orders:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

function parseItemCount(payload: string): number {
  const items: unknown = JSON.parse(payload);
  return Array.isArray(items) ? items.length : 0;
}
