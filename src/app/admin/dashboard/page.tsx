"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  Clock,
  History,
  Loader2,
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
      <div className="flex items-center justify-center p-10 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải thống kê...
      </div>
    );
  }

  const { kpi, buildingStats, recentLogs } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tổng quan Ký túc xá</h1>
        <p className="text-xs text-slate-500">
          Theo dõi công suất phòng, đơn chờ duyệt và hoạt động quản trị gần nhất.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tổng số phòng</span>
            <BedDouble className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.totalRooms}</p>
          <p className="mt-1 text-xs text-slate-500">
            {kpi.openRooms} đang mở • {kpi.lockedRooms} khóa/bảo trì
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Sức chứa / Đang ở</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {kpi.totalOccupied} / {kpi.totalCapacity}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Còn trống {Math.max(0, kpi.totalCapacity - kpi.totalOccupied)} chỗ
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tỷ lệ lấp đầy</span>
            <Percent className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {kpi.occupancyRate}%
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${Math.min(100, kpi.occupancyRate)}%` }}
            />
          </div>
        </div>

        <Link
          href="/admin/registrations"
          className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm transition hover:bg-amber-50"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>Đơn chờ duyệt</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {kpi.pendingCount}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700">
            Bấm để xét duyệt ngay →
          </p>
        </Link>
      </div>

      {/* Building Occupancy Chart & Recent Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Tỷ lệ lấp đầy theo Tòa nhà
          </h2>
          {buildingStats.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có dữ liệu tòa nhà.</p>
          ) : (
            <div className="space-y-3">
              {buildingStats.map((b) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      {b.name} ({b.code}) — {b.rooms} phòng
                    </span>
                    <span className="text-slate-900">
                      {b.occupied}/{b.capacity} ({b.rate}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.min(100, b.rate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
              <History className="h-4 w-4 text-slate-600" />
              10 hoạt động gần nhất
            </h2>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có nhật ký hoạt động nào.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {recentLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-bold text-slate-900">{l.action}</span>{" "}
                    <span className="text-slate-500">bởi {l.actor}</span>
                  </div>
                  <span className="text-slate-400">
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
