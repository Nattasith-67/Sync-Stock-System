import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  getLazadaCredentials,
  syncLazadaOrders,
  syncLazadaProducts,
  syncLazadaStock,
  writeSyncLog,
} from "@/app/lib/lazada-sync";

type SyncAction = "products" | "orders" | "stock" | "all";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const action =
    isRecord(body) && typeof body.action === "string" ? body.action : "all";
  if (!isSyncAction(action)) {
    return NextResponse.json({ error: "Unknown Lazada sync action" }, { status: 400 });
  }

  try {
    getLazadaCredentials();
    const shops = await prisma.shop.findMany({
      where: { platform: "LAZADA" },
      orderBy: { createdAt: "asc" },
    });
    if (!shops.length) {
      return NextResponse.json(
        { error: "Connect a Lazada shop before syncing" },
        { status: 409 },
      );
    }

    const results = [];
    for (const shop of shops) {
      const result: Record<string, unknown> = {
        shopId: shop.platformShopId,
      };
      try {
        if (action === "products" || action === "all") {
          result.products = await syncLazadaProducts(shop);
        }
        if (action === "orders" || action === "all") {
          result.orders = await syncLazadaOrders(shop);
        }
        if (action === "stock" || action === "all") {
          result.stock = await syncLazadaStock(shop);
        } else if (action === "orders") {
          result.stock = await syncLazadaStock(shop);
        }
        results.push(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Lazada sync error";
        await writeSyncLog("SYNC_FAILED", "FAILED", {
          shopId: shop.platformShopId,
          action,
          error: message,
        });
        results.push({ ...result, error: message });
      }
    }

    const failed = results.filter(hasSyncFailure).length;
    return NextResponse.json(
      {
        success: failed === 0,
        action,
        results,
        ...(failed ? { error: "Some Lazada items could not be synchronized" } : {}),
      },
      { status: failed ? 502 : 200 },
    );
  } catch (error) {
    console.error("Lazada sync failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Lazada sync failed",
      },
      { status: 500 },
    );
  }
}

function isSyncAction(value: string): value is SyncAction {
  return ["products", "orders", "stock", "all"].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSyncFailure(result: Record<string, unknown>): boolean {
  if ("error" in result) return true;
  return ["products", "orders", "stock"].some((key) => {
    const stage = result[key];
    if (!isRecord(stage)) return false;
    return (
      Number(stage.failed) > 0 ||
      Number(stage.skippedSkus) > 0
    );
  });
}
