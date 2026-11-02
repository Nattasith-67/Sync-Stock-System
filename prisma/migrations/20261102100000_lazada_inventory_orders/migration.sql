-- CreateTable
ALTER TABLE "Shop"
ADD COLUMN "name" TEXT,
ADD COLUMN "refreshToken" TEXT,
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "stockRestored" BOOLEAN NOT NULL DEFAULT false,
    "itemsPayload" TEXT NOT NULL DEFAULT '[]',
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_shopId_platformOrderId_key"
ON "MarketplaceOrder"("shopId", "platformOrderId");

CREATE INDEX "MarketplaceOrder_status_createdAt_idx"
ON "MarketplaceOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceOrder"
ADD CONSTRAINT "MarketplaceOrder_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
