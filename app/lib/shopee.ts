import crypto from 'crypto';

const SHOPEE_HOST = "https://partner.shopeemobile.com"; // หรือ https://partner.test-stable.shopeemobile.com สำหรับ Sandbox

interface UpdateShopeeStockParams {
  partnerId: number;
  partnerKey: string;
  shopId: number;
  accessToken: string;
  itemId: number;
  sellerStock: number; // สต็อกใหม่ที่ต้องการอัปเดต
}

// ฟังก์ชันสร้าง HMAC-SHA256 Signature สำหรับ Shopee API v2
function generateShopeeSign(partnerKey: string, baseString: string): string {
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export async function updateShopeeStock({
  partnerId,
  partnerKey,
  shopId,
  accessToken,
  itemId,
  sellerStock,
}: UpdateShopeeStockParams) {
  const path = "/api/v2/product/update_stock";
  const timestamp = Math.floor(Date.now() / 1000);

  // Base string สูตร signature ของ Shopee: partner_id + path + timestamp + access_token + shop_id
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const sign = generateShopeeSign(partnerKey, baseString);

  const url = `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: itemId,
      stock_list: [
        {
          seller_stock: [{ stock: sellerStock }],
        },
      ],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Shopee Sync Failed: ${data.message}`);
  }
  return data;
}