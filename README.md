This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## ใช้งานระบบกับ Lazada

1. เปิด PostgreSQL สำหรับพัฒนา:

   ```bash
   docker compose up -d postgres
   npx prisma migrate deploy
   npm run dev
   ```

2. ตั้ง `DATABASE_URL`, `DIRECT_URL`, `LAZADA_APP_KEY`, `LAZADA_APP_SECRET` และ `LAZADA_REDIRECT_URI` ใน `.env` โดยให้ `DATABASE_URL` เป็น URL สำหรับแอป และ `DIRECT_URL` เป็น URL เชื่อมต่อฐานข้อมูลโดยตรงสำหรับ Prisma migrations (ถ้าไม่มี `DIRECT_URL` จะใช้ `DATABASE_URL`) ค่า `LAZADA_REDIRECT_URI` ต้องตรงทุกตัวอักษรกับ callback URL ที่ลงทะเบียนใน Lazada:

   ```text
   http://localhost:3000/api/auth/callback
   ```

   เมื่อติดตั้งบน Vercel ให้ตั้ง `LAZADA_REDIRECT_URI` ใน Environment Variables เป็น callback URL ของ production ที่ลงทะเบียนใน Lazada เช่น `https://syncstock-six.vercel.app/api/auth/callback` หากเปิดจาก Vercel Preview URL ระบบจะส่งต่อไปเริ่ม OAuth บนโดเมน production นี้ และหลังเชื่อมต่อจะกลับมาที่โดเมน production
3. เพิ่ม callback URL เดียวกันใน Lazada Open Platform และเปิดสิทธิ์อ่านสินค้า อ่านคำสั่งซื้อ และแก้ไขจำนวนสินค้า
4. เปิดหน้า SyncStock แล้วเลือก **เชื่อมต่อ Lazada** เพื่อเริ่ม OAuth ห้ามเปิด callback URL เปล่าโดยตรง
5. หลังเชื่อมต่อแล้ว ใช้ปุ่ม **ซิงก์ทั้งหมด** เพื่อดึงสินค้า ตรวจคำสั่งซื้อย้อนหลัง 30 วัน และส่งสต็อกกลางไป Lazada

สินค้าที่นำเข้าครั้งแรกจะเริ่มสต็อกกลางด้วยจำนวนจาก Lazada; หลังจากนั้นสต็อกกลางเป็นค่าหลักที่ส่งกลับไปยังร้าน คำสั่งซื้อสถานะชำระเงินแล้วจะหักสต็อกเพียงครั้งเดียว และคำสั่งซื้อที่ยกเลิก/คืนสินค้าจะคืนสต็อกเมื่อระบบตรวจพบในการซิงก์ครั้งถัดไป

Callback URL สำหรับ Development คือ `http://localhost:3000/api/auth/callback` ส่วน Production ต้องใช้ URL ที่ลงทะเบียนไว้ใน Lazada และตั้งค่าเดียวกันใน `LAZADA_REDIRECT_URI` บน Vercel สำหรับ production ต้องใช้ฐานข้อมูลที่ deploy แล้ว

> **ข้อจำกัดด้านการใช้งานจริง:** เวอร์ชันนี้เป็นระบบสำหรับพัฒนา/ใช้งานภายใน และยังไม่มีบัญชีผู้ดูแลหรือระบบยืนยันตัวตน ห้ามเปิด Dashboard หรือ API ออกสู่อินเทอร์เน็ตสาธารณะจนกว่าจะเพิ่มการยืนยันตัวตนและสิทธิ์ผู้ใช้

คำสั่งซิงก์สินค้าและสต็อกใช้สิทธิ์ Lazada ของร้านที่เชื่อมต่อ ส่วนการตรวจคำสั่งซื้อจะอ่านย้อนหลัง 30 วันเพื่อรองรับการลองซิงก์ซ้ำ คำสั่งซื้อที่หาสินค้าจับคู่ไม่พบหรือสต็อกไม่พอจะถูกบันทึกเป็นข้อผิดพลาดและไม่หักสต็อกบางส่วน

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
