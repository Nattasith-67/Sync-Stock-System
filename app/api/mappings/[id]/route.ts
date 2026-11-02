import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/mappings/[id]">,
) {
  const { id } = await context.params;
  try {
    await prisma.productMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRecord(error) && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }
    console.error("Failed to delete product mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete product mapping" },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
