import { connection, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  await connection();
  try {
    const [products, lowStock, orders, shops, logs] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { stock: { lte: 5 } } }),
      prisma.marketplaceOrder.count(),
      prisma.shop.findMany({
        where: { platform: "LAZADA" },
        select: { id: true, platformShopId: true, name: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.syncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          event: true,
          status: true,
          payload: true,
          createdAt: true,
          platform: true,
        },
      }),
    ]);

    return NextResponse.json({ products, lowStock, orders, shops, logs });
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 },
    );
  }
}
