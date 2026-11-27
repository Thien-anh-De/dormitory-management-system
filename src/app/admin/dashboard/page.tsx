"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Clock,
  History,
  Percent,
  Users,
} from "lucide-react";

interface DashboardData {
  kpi: {
    totalRooms: number;
    openRooms: number;
    lockedRooms: number;
    totalCapacity: number;
    totalOccupied: number;
    occupancyRate: number;
    pendingCount: number;
  };
  buildingStats: {
    id: string;
    code: string;
    name: string;
    rooms: number;
    capacity: number;
    occupied: number;
    rate: number;
  }[];
  recentLogs: {
    id: string;
    actor: string;
    action: string;
    target_type: string;
    created_at: string;
  }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-32 animate-pulse rounded-2xl border border-indigo-100 bg-white p-5"
            />
          ))}
        </div>
      </div>
    );
  }

  const { kpi, buildingStats, recentLogs } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Tổng quan Ký túc xá
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Theo dõi công suất phòng, đơn chờ duyệt và hoạt động quản trị gần nhất.
          </p>
        </div>
        <Link
          href="/admin/rooms"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 sm:text-sm"
        >
          Quản lý phòng
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Tổng số phòng
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BedDouble className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            {kpi.totalRooms}
          </p>
          <p className="mt-1.5 text-xs font-medium text-slate-500">
            <span className="text-emerald-600 font-semibold">{kpi.openRooms} mở</span>{" "}
            • {kpi.lockedRooms} khóa/bảo trì
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Sức chứa / Đang ở
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            {kpi.totalOccupied}{" "}
            <span className="text-lg font-bold text-slate-400">
              / {kpi.totalCapacity}
            </span>
          </p>
          <p className="mt-1.5 text-xs font-medium text-slate-500">
            Còn trống{" "}
            <strong className="text-emerald-600">
              {Math.max(0, kpi.totalCapacity - kpi.totalOccupied)} chỗ
            </strong>
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Tỷ lệ lấp đầy
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            {kpi.occupancyRate}%
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all"
              style={{ width: `${Math.min(100, kpi.occupancyRate)}%` }}
            />
          </div>
        </div>

        <Link
          href="/admin/registrations"
          className="group rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              Đơn chờ duyệt
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-amber-950">
            {kpi.pendingCount}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 group-hover:underline">
            Bấm để xét duyệt ngay
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>

      {/* Building Occupancy Chart & Recent Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm space-y-4 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Tỷ lệ lấp đầy theo Tòa nhà
            </h2>
          </div>

          {buildingStats.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có dữ liệu tòa nhà.</p>
          ) : (
            <div className="space-y-4">
              {buildingStats.map((b) => (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      <span className="mr-1.5 rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700">
                        {b.code}
                      </span>
                      {b.name} — {b.rooms} phòng
                    </span>
                    <span className="text-slate-900">
                      {b.occupied}/{b.capacity}{" "}
                      <span className="text-indigo-600">({b.rate}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all"
                      style={{ width: `${Math.min(100, b.rate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm space-y-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <History className="h-4 w-4" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">
                10 hoạt động gần nhất
              </h2>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có nhật ký hoạt động nào.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {recentLogs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                      {l.action}
                    </span>{" "}
                    <span className="text-slate-500">bởi {l.actor}</span>
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {new Date(l.created_at).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
