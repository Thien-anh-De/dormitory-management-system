"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarRange,
  ChevronRight,
  ClipboardCheck,
  Clock,
  History,
  Settings,
  TrendingUp,
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

const ACTION_LABELS: Record<string, { label: string; dot: string }> = {
  UPDATE_REG_STATUS: { label: "Cập nhật trạng thái đơn", dot: "bg-[#c8102e]" },
  TRANSFER_ROOM: { label: "Chuyển phòng sinh viên", dot: "bg-sky-500" },
  TRANSFER_ROOM_OVERRIDE: { label: "Chuyển phòng (Ghi đè)", dot: "bg-amber-500" },
  ADD_STUDENT_MANUAL: { label: "Xếp sinh viên thủ công", dot: "bg-emerald-500" },
  OVERRIDE_CAPACITY: { label: "Xếp vượt sức chứa", dot: "bg-amber-600" },
  CHECKOUT_WAVE: { label: "Thanh lý toàn bộ đợt", dot: "bg-stone-700" },
  ACTIVATE_WAVE: { label: "Kích hoạt đợt đăng ký", dot: "bg-emerald-600" },
  IMPORT_BATCH: { label: "Import danh sách Excel", dot: "bg-indigo-500" },
  UPDATE_SYSTEM_CONFIG: { label: "Cập nhật cấu hình & Form", dot: "bg-purple-500" },
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard")
      .then(r => r.json())
      .then(d => {
        if (active) setData(d);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-80 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="skeleton h-56 rounded-3xl lg:col-span-6" />
          <div className="skeleton h-56 rounded-3xl lg:col-span-3" />
          <div className="skeleton h-56 rounded-3xl lg:col-span-3" />
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="skeleton h-72 rounded-3xl lg:col-span-7" />
          <div className="skeleton h-72 rounded-3xl lg:col-span-5" />
        </div>
      </div>
    );
  }

  const { kpi, buildingStats, recentLogs } = data;
  const freeBeds = Math.max(0, kpi.totalCapacity - kpi.totalOccupied);
  const pct = Math.min(100, Math.max(0, kpi.occupancyRate));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
            Tổng quan Vận hành KTX
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Theo dõi công suất giường ở thực tế, hàng chờ duyệt đơn và nhật ký toàn hệ thống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#111114] shadow-xs hover:bg-stone-100 transition"
          >
            <Settings className="h-4 w-4" />
            Mở/Đóng Cổng
          </Link>
          <Link
            href="/admin/rooms"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#c8102e] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 transition hover:bg-[#a50d26]"
          >
            <span>Bản đồ 300 Phòng</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── BENTO GRID ROW 1 (Asymmetric 6 + 3 + 3) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Hero Bento Tile: Capacity Gauge + Quick Actions */}
        <section className="bento-card rounded-3xl p-6 sm:p-7 lg:col-span-6 flex flex-col justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* SVG Circular Gauge */}
            <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
              <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="#edeae4"
                  strokeWidth="12"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="#c8102e"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-3xl font-extrabold tabular-nums text-[#111114]">
                  {pct}%
                </span>
                <span className="text-xs font-bold uppercase text-stone-500">Lấp đầy</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
                Công suất toàn ký túc xá
              </p>
              <p className="font-mono text-4xl font-extrabold tracking-tight tabular-nums text-[#111114]">
                {kpi.totalOccupied}
                <span className="text-2xl font-bold text-stone-400"> / {kpi.totalCapacity}</span>
              </p>
              <p className="text-[15px] font-semibold text-stone-600">
                Còn trống{" "}
                <span className="font-extrabold text-emerald-700">{freeBeds} giường</span> sẵn sàng tiếp nhận sinh viên
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 border-t border-black/8 pt-4">
            <Link
              href="/admin/rooms"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#f6f5f2] px-3 py-2.5 text-sm font-bold text-[#111114] hover:bg-stone-200 transition"
            >
              <BedDouble className="h-4 w-4 text-[#c8102e]" />
              Phòng ở
            </Link>
            <Link
              href="/admin/registrations"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#f6f5f2] px-3 py-2.5 text-sm font-bold text-[#111114] hover:bg-stone-200 transition"
            >
              <ClipboardCheck className="h-4 w-4 text-[#c8102e]" />
              Đơn nộp
            </Link>
            <Link
              href="/admin/waves"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#f6f5f2] px-3 py-2.5 text-sm font-bold text-[#111114] hover:bg-stone-200 transition"
            >
              <CalendarRange className="h-4 w-4 text-[#c8102e]" />
              Đợt ĐK
            </Link>
          </div>
        </section>

        {/* Pending Queue Spotlight Card */}
        <Link
          href="/admin/registrations"
          className="group relative overflow-hidden rounded-3xl obsidian-mesh p-6 sm:p-7 text-white shadow-xl shadow-black/15 lg:col-span-3 flex flex-col justify-between transition hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-red-200">
              Hồ sơ chờ duyệt
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c8102e] text-white">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="my-4">
            <p className="font-mono text-5xl font-extrabold tracking-tight tabular-nums text-white">
              {kpi.pendingCount}
            </p>
            <p className="mt-1.5 text-sm font-medium text-white/70">
              {kpi.pendingCount > 0 ? "Đơn đang giữ chỗ cần xử lý" : "Không có đơn tồn đọng"}
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#ff4d67] group-hover:translate-x-1 transition-transform">
            Đi tới xét duyệt <ChevronRight className="h-4 w-4" />
          </span>
        </Link>

        {/* Total Rooms Breakdown Card */}
        <div className="bento-card rounded-3xl p-6 sm:p-7 lg:col-span-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
              Quỹ phòng KTX
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f6f5f2] text-[#111114]">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="my-4">
            <p className="font-mono text-5xl font-extrabold tracking-tight tabular-nums text-[#111114]">
              {kpi.totalRooms}
            </p>
            <p className="mt-1.5 text-sm font-medium text-stone-500">
              Tổng số phòng đã khởi tạo
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-emerald-700">{kpi.openRooms} đang mở</span>
              <span className="text-stone-500">{kpi.lockedRooms} khóa/bảo trì</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="bg-emerald-600 transition-all"
                style={{
                  width: `${kpi.totalRooms > 0 ? Math.round((kpi.openRooms / kpi.totalRooms) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BENTO GRID ROW 2 (Building Utilization 7 + Audit Timeline 5) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Building Breakdown */}
        <section className="bento-card rounded-3xl p-6 sm:p-7 lg:col-span-7">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 rounded-full bg-[#c8102e]" />
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#111114]">
                  <TrendingUp className="h-5 w-5 text-[#c8102e]" />
                  Công suất theo từng Tòa nhà
                </h2>
                <p className="text-sm text-stone-500">Tỷ lệ lấp đầy giường thực tế tại các dãy nhà</p>
              </div>
            </div>
          </div>

          {buildingStats.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-stone-400">Chưa có dữ liệu tòa nhà.</p>
          ) : (
            <div className="space-y-5">
              {buildingStats.map(b => (
                <div key={b.id} className="rounded-2xl bg-[#f6f5f2] p-4">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-xl bg-[#111114] px-3 py-1 font-mono text-sm font-extrabold text-white">
                        {b.code}
                      </span>
                      <span className="text-base font-extrabold text-[#111114]">{b.name}</span>
                      <span className="text-sm font-medium text-stone-500">· {b.rooms} phòng</span>
                    </div>
                    <div className="font-mono text-base font-extrabold tabular-nums text-[#111114]">
                      {b.rate}%{" "}
                      <span className="font-sans text-sm font-semibold text-stone-500">
                        ({b.occupied}/{b.capacity} giường)
                      </span>
                    </div>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200/80">
                    <div
                      className="h-full rounded-full brand-gradient transition-all duration-500"
                      style={{ width: `${Math.min(100, b.rate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity Timeline */}
        <section className="bento-card rounded-3xl p-6 sm:p-7 lg:col-span-5 flex flex-col">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 rounded-full bg-[#111114]" />
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#111114]">
                <History className="h-5 w-5 text-stone-700" />
                Hoạt động gần nhất
              </h2>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-sm font-extrabold text-[#c8102e] hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-stone-400">Chưa có nhật ký hoạt động nào.</p>
          ) : (
            <div className="space-y-2.5 overflow-y-auto">
              {recentLogs.map(l => {
                const meta = ACTION_LABELS[l.action] ?? { label: l.action, dot: "bg-stone-500" };
                return (
                  <div
                    key={l.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-black/6 bg-[#f6f5f2]/60 px-4 py-3 hover:bg-[#f6f5f2] transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-[#111114]">{meta.label}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-stone-500">
                          Bởi <strong className="text-stone-700">{l.actor}</strong> ·{" "}
                          <span className="font-mono">{l.action}</span>
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-stone-500">
                      {new Date(l.created_at).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
