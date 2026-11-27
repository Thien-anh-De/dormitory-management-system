"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BedDouble, Building2, ChevronRight, Clock,
  History, Percent, TrendingUp, Users,
} from "lucide-react";

interface DashboardData {
  kpi: {
    totalRooms: number; openRooms: number; lockedRooms: number;
    totalCapacity: number; totalOccupied: number; occupancyRate: number; pendingCount: number;
  };
  buildingStats: { id: string; code: string; name: string; rooms: number; capacity: number; occupied: number; rate: number }[];
  recentLogs: { id: string; actor: string; action: string; target_type: string; created_at: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-72 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { kpi, buildingStats, recentLogs } = data;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black">Tổng quan</h1>
          <p className="mt-0.5 text-sm font-medium text-gray-500">Theo dõi công suất phòng và hoạt động hệ thống.</p>
        </div>
        <Link href="/admin/rooms"
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-red-500/25 transition hover:bg-red-700">
          Quản lý phòng <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total rooms */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Tổng phòng</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
              <BedDouble className="h-4 w-4 text-gray-700" />
            </div>
          </div>
          <p className="text-4xl font-black tracking-tight text-black">{kpi.totalRooms}</p>
          <p className="mt-2 text-xs font-semibold text-gray-500">
            <span className="text-green-600">{kpi.openRooms} mở</span> · {kpi.lockedRooms} khóa
          </p>
        </div>

        {/* Capacity */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Sức chứa</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-4xl font-black tracking-tight text-black">{kpi.totalOccupied}<span className="text-xl text-gray-400">/{kpi.totalCapacity}</span></p>
          <p className="mt-2 text-xs font-semibold text-gray-500">
            Trống <span className="text-green-600">{Math.max(0, kpi.totalCapacity - kpi.totalOccupied)} chỗ</span>
          </p>
        </div>

        {/* Occupancy */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Lấp đầy</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
              <Percent className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <p className="text-4xl font-black tracking-tight text-black">{kpi.occupancyRate}%</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${Math.min(100, kpi.occupancyRate)}%` }} />
          </div>
        </div>

        {/* Pending — CTA card */}
        <Link href="/admin/registrations"
          className="group rounded-2xl border-2 border-dashed border-red-200 bg-red-50 p-5 transition hover:border-red-400 hover:bg-red-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-red-600">Chờ duyệt</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-200">
              <Clock className="h-4 w-4 text-red-700" />
            </div>
          </div>
          <p className="text-4xl font-black tracking-tight text-red-700">{kpi.pendingCount}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-red-600 group-hover:underline">
            Xét duyệt ngay <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Building chart */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-1 rounded-full bg-red-600" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-600" />
              <h2 className="text-base font-black text-black">Tỷ lệ lấp đầy theo Tòa</h2>
            </div>
          </div>
          {buildingStats.length === 0 ? (
            <p className="text-xs text-gray-400">Chưa có dữ liệu tòa nhà.</p>
          ) : (
            <div className="space-y-5">
              {buildingStats.map(b => (
                <div key={b.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-black px-2 py-0.5 text-xs font-black text-white">{b.code}</span>
                      <span className="text-sm font-bold text-black">{b.name}</span>
                    </div>
                    <span className="text-sm font-black text-black">{b.rate}%
                      <span className="ml-1 text-xs font-normal text-gray-400">({b.occupied}/{b.capacity})</span>
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-red-600 transition-all"
                      style={{ width: `${Math.min(100, b.rate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 rounded-full bg-gray-400" />
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-600" />
                <h2 className="text-base font-black text-black">Hoạt động gần nhất</h2>
              </div>
            </div>
            <Link href="/admin/audit-logs" className="text-xs font-black text-red-600 hover:underline">
              Xem tất cả →
            </Link>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-gray-400">Chưa có nhật ký hoạt động nào.</p>
          ) : (
            <div className="space-y-1">
              {recentLogs.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" />
                    <span className="truncate text-xs font-black text-black">{l.action}</span>
                    <span className="shrink-0 text-xs text-gray-400">bởi {l.actor}</span>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-gray-400">
                    {new Date(l.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
