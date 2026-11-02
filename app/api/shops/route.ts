import { connection, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  await connection();
  try {
    const shops = await prisma.shop.findMany({
      where: { platform: "LAZADA" },
      select: {
        id: true,
        platformShopId: true,
        name: true,
        tokenExpiresAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(shops);
  } catch (error) {
    console.error("Failed to load Lazada shops:", error);
    return NextResponse.json({ error: "Failed to load shops" }, { status: 500 });
  }
}
