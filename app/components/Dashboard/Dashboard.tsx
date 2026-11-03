"use client";

import {
  AlertTriangle,
  Boxes,
  ExternalLink,
  History,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Store,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Sidebar, type TabType } from "@/app/components/Sidebar/Sidebar";

type Shop = {
  id: string;
  platformShopId: string;
  name: string | null;
  updatedAt?: string;
};

type Mapping = {
  id: string;
  platformId: string;
  platformSku: string;
  product: { id: string; sku: string; name: string; stock: number };
  shop: { id: string; platformShopId: string; name: string | null };
};

type Product = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  mappings: Mapping[];
};

type SyncLog = {
  id: string;
  event: string;
  status: string;
  payload: string;
  createdAt: string;
};

type Order = {
  id: string;
  platformOrderId: string;
  status: string;
  isPaid: boolean;
  stockDeducted: boolean;
  stockRestored: boolean;
  itemCount: number;
  updatedAt: string;
  shop: { platformShopId: string; name: string | null };
};

type DashboardData = {
  products: number;
  lowStock: number;
  orders: number;
  shops: Shop[];
  logs: SyncLog[];
};

type MappingForm = {
  productId: string;
  shopId: string;
  platformId: string;
  platformSku: string;
};

const sections: Record<TabType, { title: string; description: string }> = {
  dashboard: {
    title: "ภาพรวมระบบ",
    description: "ติดตามคลังสินค้า คำสั่งซื้อ และสถานะการซิงก์ Lazada",
  },
  inventory: {
    title: "จัดการคลังสินค้า",
    description: "จัดการสต็อกกลางและส่งจำนวนสินค้าไปยัง Lazada",
  },
  mapping: {
    title: "การจับคู่สินค้า",
    description: "จับคู่สินค้าในคลังกับ Seller SKU ของ Lazada",
  },
  logs: {
    title: "ประวัติการ Sync",
    description: "ตรวจสอบผลการนำเข้าสินค้า คำสั่งซื้อ และสต็อก",
  },
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productForm, setProductForm] = useState({ sku: "", name: "", stock: "0" });
  const [mappingForm, setMappingForm] = useState<MappingForm>({
    productId: "",
    shopId: "",
    platformId: "",
    platformSku: "",
  });

  const loadData = useCallback(async () => {
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/mappings", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" }),
      ]);
      const payloads: unknown[] = await Promise.all(
        responses.map((response) => response.json()),
      );
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex !== -1) {
        const failedPayload = payloads[failedIndex];
        throw new Error(
          isRecord(failedPayload) && typeof failedPayload.error === "string"
            ? failedPayload.error
            : "โหลดข้อมูลระบบไม่สำเร็จ",
        );
      }

      setDashboard(payloads[0] as DashboardData);
      setProducts(payloads[1] as Product[]);
      setMappings(payloads[2] as Mapping[]);
      setOrders(payloads[3] as Order[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดข้อมูลระบบไม่สำเร็จ",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
      const result = new URLSearchParams(window.location.search).get("lazada");
      if (result === "connected") {
        setNotice("เชื่อมต่อร้าน Lazada สำเร็จแล้ว");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (result === "error") {
        const reason = new URLSearchParams(window.location.search).get("reason");
        const errorMessages: Record<string, string> = {
          authorization:
            "Lazada ไม่อนุมัติการเชื่อมต่อ อาจถูกยกเลิก หรือ App Key/Callback URL ไม่ตรงกับแอปที่ลงทะเบียน",
          invalid_state:
            "สถานะการเชื่อมต่อหมดอายุหรือโดเมนเปลี่ยนระหว่างทาง กรุณาเริ่มเชื่อมต่อใหม่จากหน้าเว็บหลัก",
          missing_code:
            "Lazada ไม่ได้ส่ง Authorization Code กลับมา กรุณาตรวจสิทธิ์และการตั้งค่า OAuth ของแอป",
          token_exchange:
            "แลก Authorization Code กับ Lazada ไม่สำเร็จ กรุณาตรวจ App Key, App Secret และดู Vercel Function Logs สำหรับรายละเอียด",
          seller_info:
            "Lazada ไม่ได้ส่งข้อมูลร้านค้ากลับมา กรุณาตรวจสิทธิ์และประเทศของร้านค้า",
          database:
            "รับข้อมูลจาก Lazada แล้ว แต่บันทึกร้านค้าไม่สำเร็จ กรุณาตรวจ Database และ Vercel Function Logs",
        };
        setError(
          errorMessages[reason ?? ""] ??
            "เชื่อมต่อ Lazada ไม่สำเร็จ กรุณาตรวจ Vercel Function Logs",
        );
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function runSync(action: "all" | "products" | "orders" | "stock") {
    setIsSyncing(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/lazada/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getSyncFailureMessage(result));
      }
      setNotice(syncSummary(action));
      await loadData();
    } catch (syncError) {
      await loadData();
      setError(
        syncError instanceof Error ? syncError.message : "ซิงก์ข้อมูลไม่สำเร็จ",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          stock: Number(productForm.stock),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "เพิ่มสินค้าไม่สำเร็จ",
        );
      }
      setProductForm({ sku: "", name: "", stock: "0" });
      setNotice("เพิ่มสินค้าในคลังแล้ว");
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "เพิ่มสินค้าไม่สำเร็จ");
    }
  }

  async function saveStock(product: Product, stock: number) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "บันทึกสต็อกไม่สำเร็จ",
        );
      }
      const syncFailed =
        isRecord(result) &&
        Array.isArray(result.stockSync) &&
        result.stockSync.some(
          (entry) => isRecord(entry) && Number(entry.failed) > 0,
        );
      setNotice(
        syncFailed
          ? "บันทึกสต็อกกลางแล้ว แต่ส่งไป Lazada ไม่ครบ ดูรายละเอียดในประวัติ Sync"
          : "บันทึกสต็อกและซิงก์ Lazada แล้ว",
      );
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกสต็อกไม่สำเร็จ");
    }
  }

  async function saveMapping(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingForm),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "บันทึกการจับคู่ไม่สำเร็จ",
        );
      }
      setMappingForm({
        productId: "",
        shopId: "",
        platformId: "",
        platformSku: "",
      });
      setNotice("บันทึกการจับคู่สินค้าแล้ว");
      await loadData();
    } catch (mappingError) {
      setError(
        mappingError instanceof Error
          ? mappingError.message
          : "บันทึกการจับคู่ไม่สำเร็จ",
      );
    }
  }

  async function deleteMapping(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/mappings/${id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "ลบการจับคู่ไม่สำเร็จ",
        );
      }
      setNotice("ลบการจับคู่แล้ว");
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "ลบการจับคู่ไม่สำเร็จ",
      );
    }
  }

  const activeSection = sections[activeTab];
  const connected = (dashboard?.shops.length ?? 0) > 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSyncing={isSyncing}
        onSyncAll={() => void runSync("all")}
        lazadaConnected={connected}
      />

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-indigo-600">SyncStock</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {activeSection.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {activeSection.description}
              </p>
            </div>
            <a
              href="/api/auth/lazada/authorize"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <Store className="h-4 w-4" />
              {connected ? "เชื่อมต่อร้านเพิ่ม" : "เชื่อมต่อ Lazada"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </header>

          {(error || notice) && (
            <div
              role={error ? "alert" : "status"}
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {error || notice}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              กำลังโหลดข้อมูล…
            </div>
          ) : activeTab === "dashboard" ? (
            <DashboardPanel
              data={dashboard}
              isSyncing={isSyncing}
              onSync={runSync}
            />
          ) : activeTab === "inventory" ? (
            <InventoryPanel
              products={products}
              form={productForm}
              setForm={setProductForm}
              onCreate={createProduct}
              onSaveStock={saveStock}
              isSyncing={isSyncing}
              onSyncProducts={() => void runSync("products")}
            />
          ) : activeTab === "mapping" ? (
            <MappingPanel
              mappings={mappings}
              products={products}
              shops={dashboard?.shops ?? []}
              form={mappingForm}
              setForm={setMappingForm}
              onSave={saveMapping}
              onDelete={deleteMapping}
              onSyncProducts={() => void runSync("products")}
              isSyncing={isSyncing}
            />
          ) : (
            <LogsPanel
              logs={dashboard?.logs ?? []}
              orders={orders}
              onSyncOrders={() => void runSync("orders")}
              isSyncing={isSyncing}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardPanel({
  data,
  isSyncing,
  onSync,
}: {
  data: DashboardData | null;
  isSyncing: boolean;
  onSync: (action: "all" | "products" | "orders" | "stock") => Promise<void>;
}) {
  const metrics = [
    { label: "สินค้าในคลัง", value: data?.products ?? 0, icon: Boxes },
    { label: "สต็อกต่ำ (ไม่เกิน 5)", value: data?.lowStock ?? 0, icon: AlertTriangle },
    { label: "คำสั่งซื้อที่ตรวจพบ", value: data?.orders ?? 0, icon: Package },
  ];

  return (
    <>
      <section
        aria-label="สถิติภาพรวม"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {metrics.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <Icon aria-hidden="true" className="h-5 w-5 text-indigo-500" />
            </div>
            <p className="mt-5 text-3xl font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">ร้าน Lazada</h2>
              <p className="mt-1 text-sm text-slate-500">
                {data?.shops.length
                  ? "เชื่อมต่อร้านแล้ว เลือกซิงก์สินค้า คำสั่งซื้อ หรือสต็อก"
                  : "ยังไม่มีร้านที่เชื่อมต่อ"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onSync("all")}
              disabled={isSyncing || !data?.shops.length}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              ซิงก์ทั้งหมด
            </button>
          </div>
          {data?.shops.length ? (
            <ul className="divide-y divide-slate-100">
              {data.shops.map((shop) => (
                <li key={shop.id} className="flex items-center justify-between py-3">
                  <span className="font-medium text-slate-800">
                    {shop.name || `ร้าน ${shop.platformShopId}`}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    เชื่อมต่อแล้ว
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <a
              href="/api/auth/lazada/authorize"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Store className="h-4 w-4" /> เริ่มเชื่อมต่อ Lazada
            </a>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["products", "ดึงสินค้า"],
                ["orders", "ดึงคำสั่งซื้อ"],
                ["stock", "ซิงก์สต็อก"],
              ] as const
            ).map(([action, label]) => (
              <button
                key={action}
                type="button"
                onClick={() => void onSync(action)}
                disabled={isSyncing || !data?.shops.length}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <RecentLogs logs={data?.logs ?? []} />
      </section>
    </>
  );
}

function InventoryPanel({
  products,
  form,
  setForm,
  onCreate,
  onSaveStock,
  isSyncing,
  onSyncProducts,
}: {
  products: Product[];
  form: { sku: string; name: string; stock: string };
  setForm: (form: { sku: string; name: string; stock: string }) => void;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveStock: (product: Product, stock: number) => void;
  isSyncing: boolean;
  onSyncProducts: () => void;
}) {
  const [stockValues, setStockValues] = useState<Record<string, string>>({});
  return (
    <>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">เพิ่มสินค้าในคลัง</h2>
            <p className="mt-1 text-sm text-slate-500">
              สินค้าที่ดึงจาก Lazada จะสร้างหรือจับคู่ SKU ให้อัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncProducts}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            ดึงสินค้าจาก Lazada
          </button>
        </div>
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto]">
          <input
            required
            aria-label="SKU"
            placeholder="SKU"
            value={form.sku}
            onChange={(event) => setForm({ ...form, sku: event.target.value })}
            className={inputClass}
          />
          <input
            required
            aria-label="ชื่อสินค้า"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
          />
          <input
            required
            aria-label="จำนวนสต็อก"
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(event) => setForm({ ...form, stock: event.target.value })}
            className={inputClass}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> เพิ่มสินค้า
          </button>
        </form>
      </section>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">รายการสินค้า ({products.length})</h2>
        </div>
        {products.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">SKU / สินค้า</th>
                  <th className="px-5 py-3">Seller SKU ที่จับคู่</th>
                  <th className="px-5 py-3">สต็อกกลาง</th>
                  <th className="px-5 py-3">ปรับสต็อก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.sku}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {product.mappings.length
                        ? product.mappings.map((mapping) => mapping.platformSku).join(", ")
                        : "ยังไม่จับคู่"}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {product.stock}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`ปรับสต็อก ${product.sku}`}
                          type="number"
                          min="0"
                          step="1"
                          value={stockValues[product.id] ?? String(product.stock)}
                          onChange={(event) =>
                            setStockValues({
                              ...stockValues,
                              [product.id]: event.target.value,
                            })
                          }
                          className={`${inputClass} w-24`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void onSaveStock(
                              product,
                              Number(stockValues[product.id] ?? product.stock),
                            )
                          }
                          disabled={
                            !/^\d+$/.test(
                              stockValues[product.id] ?? String(product.stock),
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          บันทึก
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ยังไม่มีสินค้า ลองดึงจาก Lazada หรือเพิ่ม SKU ใหม่" />
        )}
      </div>
    </>
  );
}

function MappingPanel({
  mappings,
  products,
  shops,
  form,
  setForm,
  onSave,
  onDelete,
  onSyncProducts,
  isSyncing,
}: {
  mappings: Mapping[];
  products: Product[];
  shops: Shop[];
  form: MappingForm;
  setForm: (form: MappingForm) => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
  onSyncProducts: () => void;
  isSyncing: boolean;
}) {
  return (
    <>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">เพิ่ม/แก้ไขการจับคู่</h2>
            <p className="mt-1 text-sm text-slate-500">
              ใช้ Lazada SKU ID และ Seller SKU จากหน้าจัดการสินค้า Lazada
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncProducts}
            disabled={isSyncing}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ดึงรายการ Lazada ก่อน
          </button>
        </div>
        {!shops.length ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ต้องเชื่อมต่อร้าน Lazada ก่อนจึงจะจับคู่สินค้าได้
          </p>
        ) : (
          <form onSubmit={onSave} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              required
              aria-label="สินค้าในคลัง"
              value={form.productId}
              onChange={(event) => setForm({ ...form, productId: event.target.value })}
              className={inputClass}
            >
              <option value="">เลือกสินค้าในคลัง</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.name}
                </option>
              ))}
            </select>
            <select
              required
              aria-label="ร้าน Lazada"
              value={form.shopId}
              onChange={(event) => setForm({ ...form, shopId: event.target.value })}
              className={inputClass}
            >
              <option value="">เลือกร้าน Lazada</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name || shop.platformShopId}
                </option>
              ))}
            </select>
            <input
              required
              aria-label="Lazada SKU ID"
              placeholder="Lazada SKU ID"
              value={form.platformId}
              onChange={(event) => setForm({ ...form, platformId: event.target.value })}
              className={inputClass}
            />
            <div className="flex gap-2">
              <input
                required
                aria-label="Seller SKU"
                placeholder="Seller SKU"
                value={form.platformSku}
                onChange={(event) =>
                  setForm({ ...form, platformSku: event.target.value })
                }
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                บันทึก
              </button>
            </div>
          </form>
        )}
      </section>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            การจับคู่ทั้งหมด ({mappings.length})
          </h2>
        </div>
        {mappings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-162.5 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">สินค้าในคลัง</th>
                  <th className="px-5 py-3">ร้าน Lazada</th>
                  <th className="px-5 py-3">Seller SKU</th>
                  <th className="px-5 py-3">SKU ID</th>
                  <th className="px-5 py-3">สต็อกกลาง</th>
                  <th className="px-5 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{mapping.product.name}</p>
                      <p className="text-xs text-slate-500">{mapping.product.sku}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {mapping.shop.name || mapping.shop.platformShopId}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{mapping.platformSku}</td>
                    <td className="px-5 py-4 text-slate-600">{mapping.platformId}</td>
                    <td className="px-5 py-4 font-medium">{mapping.product.stock}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => void onDelete(mapping.id)}
                        aria-label={`ลบการจับคู่ ${mapping.platformSku}`}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ยังไม่มีการจับคู่ กดดึงรายการ Lazada เพื่อสร้างการจับคู่อัตโนมัติ" />
        )}
      </div>
    </>
  );
}

function LogsPanel({
  logs,
  orders,
  onSyncOrders,
  isSyncing,
}: {
  logs: SyncLog[];
  orders: Order[];
  onSyncOrders: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">คำสั่งซื้อ Lazada</h2>
            <p className="mt-1 text-sm text-slate-500">
              ตรวจคำสั่งซื้อ 30 วันล่าสุด; หักสต็อกเมื่อสถานะชำระเงินแล้ว
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncOrders}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            ตรวจคำสั่งซื้อ
          </button>
        </div>
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-162.5 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">เลขที่คำสั่งซื้อ</th>
                  <th className="px-5 py-3">สถานะ Lazada</th>
                  <th className="px-5 py-3">รายการ</th>
                  <th className="px-5 py-3">สต็อก</th>
                  <th className="px-5 py-3">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {order.platformOrderId}
                    </td>
                    <td className="px-5 py-4 capitalize text-slate-600">
                      {order.status}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{order.itemCount}</td>
                    <td className="px-5 py-4">
                      {order.stockRestored ? (
                        <span className="text-slate-500">คืนสต็อกแล้ว</span>
                      ) : order.stockDeducted ? (
                        <span className="text-emerald-700">หักแล้ว</span>
                      ) : order.isPaid ? (
                        <span className="text-rose-700">รอดำเนินการ</span>
                      ) : (
                        <span className="text-slate-500">รอชำระเงิน</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(order.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="ยังไม่มีคำสั่งซื้อ กดตรวจคำสั่งซื้อหลังเชื่อมต่อร้านแล้ว" />
        )}
      </section>
      <RecentLogs logs={logs} />
    </div>
  );
}

function RecentLogs({ logs }: { logs: SyncLog[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-slate-900">กิจกรรมล่าสุด</h2>
      </div>
      {logs.length ? (
        <ul className="divide-y divide-slate-100">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {formatEvent(log.event)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{logSummary(log.payload)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(log.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                log.status === "SUCCESS"
                  ? "bg-emerald-50 text-emerald-700"
                  : log.status === "PARTIAL"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-rose-50 text-rose-700"
              }`}>
                {log.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">ยังไม่มีประวัติการทำงาน</p>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Link2 className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

function logSummary(payload: string): string {
  try {
    const details: unknown = JSON.parse(payload);
    if (!isRecord(details)) return "";
    if (typeof details.error === "string") return details.error;
    if (typeof details.shopId === "string") return `ร้าน ${details.shopId}`;
    if (typeof details.mappedSkus === "number") {
      return `จับคู่ ${details.mappedSkus} SKU`;
    }
    if (typeof details.synced === "number") {
      return `ซิงก์ ${details.synced}/${String(details.total ?? details.synced)} รายการ`;
    }
    if (typeof details.processed === "number") {
      return `ประมวลผล ${details.processed} คำสั่งซื้อ`;
    }
    return "";
  } catch {
    return "รายละเอียดไม่พร้อมใช้งาน";
  }
}

function getSyncFailureMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return "ซิงก์ไม่สำเร็จ โปรดตรวจประวัติ Sync";
  }

  const failures: string[] = [];
  if (Array.isArray(payload.results)) {
    for (const result of payload.results) {
      if (!isRecord(result)) continue;
      const shop = typeof result.shopId === "string" ? `ร้าน ${result.shopId}` : "ร้าน Lazada";
      if (typeof result.error === "string") {
        failures.push(`${shop}: ${result.error}`);
        continue;
      }

      for (const stageName of ["products", "orders", "stock"] as const) {
        const stage = result[stageName];
        if (!isRecord(stage)) continue;
        const failed = Number(stage.failed) || 0;
        const skipped = Number(stage.skippedSkus) || 0;
        const stageErrors = Array.isArray(stage.errors)
          ? stage.errors.filter((error): error is string => typeof error === "string")
          : [];
        if (failed || skipped || stageErrors.length) {
          failures.push(
            `${shop} (${stageName}): ${[
              failed ? `ล้มเหลว ${failed} รายการ` : "",
              skipped ? `ข้าม ${skipped} SKU` : "",
              ...stageErrors,
            ]
              .filter(Boolean)
              .join(", ")}`,
          );
        }
      }
    }
  }

  if (failures.length) {
    return `ซิงก์ไม่สำเร็จ: ${failures.join(" | ")}`;
  }
  return typeof payload.error === "string"
    ? payload.error
    : "ซิงก์ไม่สำเร็จ โปรดตรวจประวัติ Sync";
}

function formatEvent(event: string): string {
  return event
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^\w|\s\w)/g, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function syncSummary(action: "all" | "products" | "orders" | "stock"): string {
  const messages = {
    all: "ซิงก์สินค้า คำสั่งซื้อ และสต็อกเสร็จแล้ว",
    products: "ดึงสินค้าและจับคู่ SKU จาก Lazada เสร็จแล้ว",
    orders: "ตรวจสอบคำสั่งซื้อและปรับสต็อกเสร็จแล้ว",
    stock: "ส่งสต็อกกลางไปยัง Lazada เสร็จแล้ว",
  };
  return messages[action];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
