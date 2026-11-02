"use client";

import React from "react";
import { 
  LayoutDashboard, 
  Package, 
  Link2, 
  History, 
  Store, 
  RefreshCw 
} from "lucide-react";

export type TabType = "dashboard" | "inventory" | "mapping" | "logs";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isSyncing?: boolean;
  onSyncAll?: () => void;
  lazadaConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isSyncing = false,
  onSyncAll,
  lazadaConnected = false,
}) => {
  // รายการเมนูใน Sidebar
  const navItems = [
    {
      id: "dashboard" as TabType,
      label: "ภาพรวมระบบ",
      subLabel: "Dashboard Overview",
      icon: LayoutDashboard,
    },
    {
      id: "inventory" as TabType,
      label: "จัดการคลังสินค้า",
      subLabel: "Stock Management",
      icon: Package,
    },
    {
      id: "mapping" as TabType,
      label: "การจับคู่สินค้า",
      subLabel: "SKU Mapping",
      icon: Link2,
    },
    {
      id: "logs" as TabType,
      label: "ประวัติการ Sync",
      subLabel: "Webhook & API Logs",
      icon: History,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 text-slate-300">
      {/* 1. Header & Logo */}
      <div>
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
              S
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-tight text-lg">
                SyncStock
              </h1>
              <p className="text-xs text-slate-400 font-mono">v2.4.0 • Enterprise</p>
            </div>
          </div>
        </div>

        {/* 2. Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Main Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 group ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <div className="text-left">
                  <div className="leading-none">{item.label}</div>
                  <div
                    className={`text-[10px] mt-1 ${
                      isActive ? "text-indigo-200" : "text-slate-500"
                    }`}
                  >
                    {item.subLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Bottom Actions & Channel Status */}
      <div className="p-4 border-t border-slate-800/80 space-y-4">
        {/* Marketplace Status Summary */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>สถานะการเชื่อมต่อ</span>
            <span className="flex h-2 w-2 relative">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                lazadaConnected ? "bg-emerald-500" : "bg-slate-500"
              }`}></span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
              <Store className="w-3.5 h-3.5" /> Lazada
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
              lazadaConnected
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-slate-400 bg-slate-700/40 border-slate-600/40"
            }`}>
              {lazadaConnected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
            </span>
          </div>
        </div>

        {/* Action Button */}
        {onSyncAll && (
          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} />
            {isSyncing ? "กำลังซิงค์สต็อก..." : "บังคับซิงค์ทันที (Sync All)"}
          </button>
        )}
      </div>
    </aside>
  );
};