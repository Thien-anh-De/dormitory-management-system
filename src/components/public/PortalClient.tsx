"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BedDouble,
  Building2,
  Clock,
  Grid2x2,
  LayoutGrid,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldOff,
  Sparkles,
  X,
} from "lucide-react";
import type { PublicRoom, PublicRoomsPayload } from "@/lib/types";
import { RoomCard } from "./RoomCard";
import { RegistrationModal } from "./RegistrationModal";
import { cn } from "@/lib/utils";

function formatTimeHHMMSS(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour12: false });
}

function getCountdownParts(ms: number) {
  if (ms <= 0) return { days: 0, hrs: "00", mins: "00", secs: "00" };
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs  = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");
  return { days, hrs, mins, secs };
}

export function PortalClient() {
  const [data, setData] = useState<PublicRoomsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [nowMs, setNowMs] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [selectedFloorByBuilding, setSelectedFloorByBuilding] = useState<Record<string, number | "ALL">>({});
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchRoom, setSearchRoom] = useState("");
  const [viewMode, setViewMode] = useState<"CARDS" | "MATRIX">("CARDS");
  const [activeRoom, setActiveRoom] = useState<PublicRoom | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/public/rooms", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
      setToastMsg(null);
    } catch {
      setToastMsg("Không thể tải danh sách phòng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/rooms", { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(json => { if (active) setData(json); })
      .catch(() => { if (active) setToastMsg("Không thể tải danh sách phòng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, []);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const id = setTimeout(() => setRefreshCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [refreshCooldown]);

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(3);
    fetchRooms();
  };

  const handleRoomStale = (roomId: string, errorCode: string) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rooms: prev.rooms.map(r => {
          if (r.id !== roomId) return r;
          if (errorCode === "ROOM_FULL") return { ...r, current_count: r.capacity };
          if (errorCode === "ROOM_LOCKED") return { ...r, is_locked: true };
          return r;
        }),
      };
    });
    fetchRooms();
  };

  const portalStatus = useMemo(() => {
    if (!data) return { isOpen: false, reason: "Đang tải..." };
    const cfg = data.system_config;
    if (!data.active_wave) return { isOpen: false, reason: "Hiện chưa có đợt đăng ký nào đang mở." };
    if (!cfg.is_portal_open) return { isOpen: false, reason: "Cổng đăng ký hiện đang tạm đóng." };
    if (nowMs > 0 && cfg.open_at && nowMs < new Date(cfg.open_at).getTime()) {
      return { isOpen: false, countdownParts: getCountdownParts(new Date(cfg.open_at).getTime() - nowMs), reason: "Cổng đăng ký sắp mở sau" };
    }
    if (nowMs > 0 && cfg.close_at && nowMs > new Date(cfg.close_at).getTime()) {
      return { isOpen: false, reason: "Đã hết thời gian đăng ký cho đợt này." };
    }
    return { isOpen: true, reason: "" };
  }, [data, nowMs]);

  const buildingsMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["buildings"][number]>();
    for (const b of data?.buildings ?? []) m.set(b.id, b);
    return m;
  }, [data]);

  const amenitiesMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["amenities"][number]>();
    for (const a of data?.amenities ?? []) m.set(a.id, a);
    return m;
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, availableRooms: 0, fullRooms: 0, freeBeds: 0, totalBeds: 0 };
    let availableRooms = 0, fullRooms = 0, freeBeds = 0, totalBeds = 0;
    for (const r of data.rooms) {
      const b = buildingsMap.get(r.building_id);
      if (!r.is_locked && !b?.is_locked && r.capacity > 0) {
        totalBeds += r.capacity;
        const left = Math.max(0, r.capacity - r.current_count);
        freeBeds += left;
        if (left > 0) availableRooms++;
        else fullRooms++;
      }
    }
    return { total: data.rooms.length, availableRooms, fullRooms, freeBeds, totalBeds };
  }, [data, buildingsMap]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const kw = searchRoom.trim().toLowerCase();
    return data.rooms.filter(room => {
      if (selectedBuilding !== "ALL" && room.building_id !== selectedBuilding) return false;
      const effGender = room.fixed_gender ?? room.gender_type;
      if (genderFilter !== "ALL" && effGender !== genderFilter) return false;
      if (onlyAvailable) {
        const b = buildingsMap.get(room.building_id);
        if (room.capacity === 0 || room.current_count >= room.capacity || room.is_locked || b?.is_locked) return false;
      }
      if (selectedAmenities.length > 0 && !selectedAmenities.every(id => room.amenity_ids.includes(id))) return false;
      if (kw && !room.room_code.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [data, selectedBuilding, genderFilter, onlyAvailable, selectedAmenities, searchRoom, buildingsMap]);

  const hasActiveFilters = selectedBuilding !== "ALL" || genderFilter !== "ALL" || selectedAmenities.length > 0 || onlyAvailable || searchRoom.trim() !== "";

  const grouped = useMemo(() => {
    if (!data) return [];
    const byB = new Map<string, Map<number, PublicRoom[]>>();
    for (const r of filteredRooms) {
      let floors = byB.get(r.building_id);
      if (!floors) { floors = new Map(); byB.set(r.building_id, floors); }
      const list = floors.get(r.floor) ?? [];
      list.push(r);
      floors.set(r.floor, list);
    }
    return data.buildings
      .filter(b => byB.has(b.id))
      .map(b => {
        const allFloors = Array.from(byB.get(b.id)!.entries())
          .sort(([a], [c]) => a - c)
          .map(([floor, rooms]) => ({ floor, rooms }));
        const availableCount = allFloors.flatMap(f => f.rooms).filter(
          r => !b.is_locked && !r.is_locked && r.capacity > 0 && r.current_count < r.capacity
        ).length;
        return {
          building: b,
          floors: allFloors,
          totalRooms: allFloors.reduce((acc, f) => acc + f.rooms.length, 0),
          availableCount,
        };
      });
  }, [data, filteredRooms]);

  const toggleAmenity = (id: string) =>
    setSelectedAmenities(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-28">
      {/* ── EDITORIAL BENTO HERO ── */}
      <section className="relative overflow-hidden rounded-3xl obsidian-mesh p-6 text-white shadow-2xl shadow-black/15 sm:p-8 lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* Narrative */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-[#c8102e]/25 px-3.5 py-1.5 text-xs sm:text-[13px] font-bold tracking-wide text-red-200 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                {data?.active_wave?.name ?? "Chưa mở đợt"}
              </span>
              {portalStatus.isOpen ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs sm:text-[13px] font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Đang mở tiếp nhận đơn
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3.5 py-1.5 text-xs sm:text-[13px] font-bold text-amber-200">
                  <ShieldOff className="h-3.5 w-3.5" />
                  Cổng chưa mở
                </span>
              )}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight leading-[1.15] sm:text-4xl lg:text-[44px]">
              Chọn Không Gian Nội Trú
              <span className="block text-[#ff4d67]">Ký Túc Xá HANU</span>
            </h1>

            <p className="max-w-xl text-[15px] sm:text-base text-white/75 leading-relaxed">
              Xem trực tiếp số giường trống từng phòng theo tòa nhà và tầng, chọn tiện ích phù hợp và gửi hồ sơ trực tuyến chỉ trong 30 giây.
            </p>

            {data?.fetched_at && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-white/55">
                <span>
                  Đồng bộ lúc{" "}
                  <strong className="font-mono text-white/90">{formatTimeHHMMSS(data.fetched_at)}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={refreshCooldown > 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-1 text-xs sm:text-[13px] font-bold text-white hover:bg-white/15 disabled:opacity-50 transition"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshCooldown > 0 && "animate-spin")} />
                  {refreshCooldown > 0 ? `Chờ ${refreshCooldown}s` : "Làm mới ngay"}
                </button>
              </div>
            )}
          </div>

          {/* Bento Stats Panel */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <button
              type="button"
              onClick={() => setOnlyAvailable(v => !v)}
              className={cn(
                "col-span-2 rounded-2xl border p-5 text-left transition-all",
                onlyAvailable
                  ? "border-red-400 bg-[#c8102e] shadow-lg shadow-red-900/40"
                  : "border-red-500/35 bg-red-600/20 hover:bg-red-600/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-red-200">
                  Giường còn trống toàn KTX
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white">
                  {onlyAvailable ? "Đang lọc còn chỗ ✓" : "Bấm để lọc"}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                  {stats.freeBeds}
                </span>
                <span className="text-sm sm:text-[15px] font-semibold text-white/75">
                  chỗ trống / {stats.totalBeds} giường ({stats.availableRooms} phòng)
                </span>
              </div>
            </button>

            <div className="rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs sm:text-[13px] font-semibold text-white/60">Tổng số phòng</p>
              <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-white">{stats.total}</p>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs sm:text-[13px] font-semibold text-white/60">Phòng đã đầy</p>
              <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-white/85">{stats.fullRooms}</p>
            </div>
          </div>
        </div>

        {/* Countdown / Closed Banner */}
        {!portalStatus.isOpen && (
          <div className="relative mt-6 flex flex-col gap-4 rounded-2xl border border-amber-400/25 bg-white/8 p-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-md">
            <div className="flex items-center gap-3 text-[15px] font-bold text-amber-200">
              <Clock className="h-5 w-5 shrink-0 text-amber-300" />
              <span>{portalStatus.reason}</span>
            </div>
            {portalStatus.countdownParts && (
              <div className="flex items-center gap-2 font-mono">
                {portalStatus.countdownParts.days > 0 && (
                  <div className="rounded-xl bg-white/12 px-3.5 py-2 text-center">
                    <p className="text-2xl font-extrabold leading-none">{portalStatus.countdownParts.days}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/60">NGÀY</p>
                  </div>
                )}
                {[
                  { v: portalStatus.countdownParts.hrs, label: "GIỜ" },
                  { v: portalStatus.countdownParts.mins, label: "PHÚT" },
                  { v: portalStatus.countdownParts.secs, label: "GIÂY" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-[#c8102e] px-3.5 py-2 text-center shadow-md">
                    <p className="text-2xl font-extrabold leading-none tabular-nums">{item.v}</p>
                    <p className="mt-1 text-[11px] font-semibold text-red-100">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcement */}
        {data?.system_config.announcement && (
          <div className="relative mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/15 px-4 py-3.5 text-[15px] text-amber-100">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="whitespace-pre-line leading-relaxed font-medium">{data.system_config.announcement}</p>
          </div>
        )}
      </section>

      {toastMsg && (
        <div className="animate-shake flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50 px-5 py-3.5 text-[15px] font-bold text-[#c8102e]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* ── AIRBNB-STYLE BUILDING RAIL + COMMAND BAR ── */}
      <section className="bento-card rounded-3xl p-4 sm:p-5 space-y-4">
        {/* Top Row: Building Pills + View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedBuilding("ALL")}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm sm:text-[15px] font-bold transition-all",
                selectedBuilding === "ALL"
                  ? "bg-[#111114] text-white shadow-sm"
                  : "bg-[#f6f5f2] text-stone-700 hover:bg-stone-200"
              )}
            >
              Tất cả tòa nhà ({data?.rooms.length ?? 0})
            </button>
            {(data?.buildings ?? []).map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBuilding(b.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm sm:text-[15px] font-bold transition-all",
                  selectedBuilding === b.id
                    ? "bg-[#c8102e] text-white shadow-md shadow-red-600/20"
                    : "bg-[#f6f5f2] text-stone-700 hover:bg-stone-200"
                )}
              >
                <Building2 className="h-4 w-4" />
                {b.name}
                <span className={cn("text-xs font-extrabold", selectedBuilding === b.id ? "text-red-100" : "text-stone-400")}>
                  {b.code}
                </span>
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-2xl bg-[#f6f5f2] p-1 border border-black/6">
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition",
                viewMode === "CARDS" ? "bg-white text-[#111114] shadow-sm" : "text-stone-500 hover:text-[#111114]"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Thẻ phòng
            </button>
            <button
              type="button"
              onClick={() => setViewMode("MATRIX")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition",
                viewMode === "MATRIX" ? "bg-white text-[#111114] shadow-sm" : "text-stone-500 hover:text-[#111114]"
              )}
            >
              <Grid2x2 className="h-4 w-4" />
              Sơ đồ nhanh
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
          {/* Search input */}
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              value={searchRoom}
              onChange={e => setSearchRoom(e.target.value)}
              placeholder="Tìm mã phòng (VD: 201D10)..."
              className="min-h-[48px] w-full rounded-2xl border border-black/12 bg-[#f6f5f2] pl-11 pr-10 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/15"
            />
            {searchRoom && (
              <button
                type="button"
                onClick={() => setSearchRoom("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-200 hover:text-[#111114]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Gender Segmented Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#f6f5f2] p-1.5 lg:col-span-5">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "MALE", label: "Phòng Nam" },
              { id: "FEMALE", label: "Phòng Nữ" },
              { id: "EMPTY", label: "Chưa gán" },
            ].map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id)}
                className={cn(
                  "flex-1 min-w-[74px] rounded-xl px-3 py-2 text-sm font-bold transition",
                  genderFilter === g.id
                    ? "bg-[#111114] text-white shadow-sm"
                    : "text-stone-600 hover:text-[#111114]"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center gap-2 lg:col-span-3">
            <button
              type="button"
              onClick={() => setOnlyAvailable(v => !v)}
              className={cn(
                "flex min-h-[48px] flex-1 items-center justify-between rounded-2xl border px-4 text-[15px] font-bold transition",
                onlyAvailable
                  ? "border-[#c8102e] bg-[#c8102e] text-white shadow-md shadow-red-600/20"
                  : "border-black/12 bg-[#f6f5f2] text-[#111114] hover:bg-stone-200/70"
              )}
            >
              <span>Chỉ còn chỗ</span>
              <span className={cn("relative ml-2 inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors", onlyAvailable ? "bg-white/30" : "bg-stone-300")}>
                <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", onlyAvailable ? "translate-x-5" : "translate-x-0")} />
              </span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBuilding("ALL");
                  setGenderFilter("ALL");
                  setSelectedAmenities([]);
                  setOnlyAvailable(false);
                  setSearchRoom("");
                  setSelectedFloorByBuilding({});
                }}
                title="Đặt lại bộ lọc"
                className="flex min-h-[48px] items-center justify-center rounded-2xl border border-black/12 bg-white px-3.5 text-sm font-bold text-stone-700 hover:bg-stone-100"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Amenities Row */}
        {(data?.amenities.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-bold text-stone-500 mr-1">Tiện ích:</span>
            {data!.amenities.map(a => {
              const on = selectedAmenities.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-all",
                    on
                      ? "border-[#c8102e] bg-[#c8102e] text-white shadow-sm"
                      : "border-black/12 bg-white text-stone-700 hover:border-black/30 hover:bg-[#f6f5f2]"
                  )}
                >
                  {a.icon && <span>{a.icon}</span>}
                  {a.name}
                </button>
              );
            })}
            <span className="ml-auto text-sm font-bold text-stone-500">
              Hiển thị <strong className="text-[#111114]">{filteredRooms.length}</strong> phòng
            </span>
          </div>
        )}
      </section>

      {/* ── BUILDING SECTIONS & ROOM GRID / MATRIX ── */}
      {grouped.length === 0 ? (
        <div className="bento-card rounded-3xl border-2 border-dashed border-black/15 p-14 text-center">
          <BedDouble className="mx-auto mb-3 h-10 w-10 text-stone-400" />
          <p className="text-lg font-extrabold text-[#111114]">
            {data?.rooms.length === 0
              ? "Chưa có dữ liệu phòng nào trong hệ thống."
              : "Không tìm thấy phòng phù hợp bộ lọc"}
          </p>
          <p className="mt-1 text-[15px] text-stone-500">
            Thử tắt bớt điều kiện lọc hoặc chọn tòa nhà khác.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ building, floors, totalRooms, availableCount }) => {
            const activeFloor = selectedFloorByBuilding[building.id] ?? "ALL";
            const visibleFloors = activeFloor === "ALL" ? floors : floors.filter(f => f.floor === activeFloor);

            return (
              <section key={building.id} className="space-y-5">
                {/* Building Header + Floor Quick Filter */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111114] font-mono text-base font-extrabold text-white">
                      {building.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-extrabold tracking-tight text-[#111114]">
                          {building.name}
                        </h2>
                        {building.is_locked && (
                          <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white">
                            Tòa đang khóa
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-stone-500">
                        {totalRooms} phòng ·{" "}
                        <strong className="text-emerald-700">{availableCount} phòng còn chỗ</strong>
                      </p>
                    </div>
                  </div>

                  {/* Quick Floor Switcher Pills */}
                  {floors.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedFloorByBuilding(p => ({ ...p, [building.id]: "ALL" }))}
                        className={cn(
                          "rounded-xl px-3.5 py-2 text-sm font-bold transition",
                          activeFloor === "ALL"
                            ? "bg-[#111114] text-white"
                            : "bg-white border border-black/10 text-stone-600 hover:bg-stone-100"
                        )}
                      >
                        Tất cả tầng
                      </button>
                      {floors.map(({ floor }) => (
                        <button
                          key={floor}
                          type="button"
                          onClick={() => setSelectedFloorByBuilding(p => ({ ...p, [building.id]: floor }))}
                          className={cn(
                            "rounded-xl px-3.5 py-2 text-sm font-bold transition",
                            activeFloor === floor
                              ? "bg-[#c8102e] text-white shadow-sm"
                              : "bg-white border border-black/10 text-stone-600 hover:bg-stone-100"
                          )}
                        >
                          Tầng {floor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {visibleFloors.map(({ floor, rooms }) => (
                  <div key={floor} className="space-y-3.5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-[#111114] px-3.5 py-1 text-sm font-extrabold text-white">
                        Tầng {floor}
                      </span>
                      <span className="text-sm font-semibold text-stone-500">
                        {rooms.length} phòng
                      </span>
                    </div>

                    {viewMode === "CARDS" ? (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {rooms.map(room => (
                          <RoomCard
                            key={room.id}
                            room={room}
                            buildingLocked={building.is_locked}
                            amenitiesMap={amenitiesMap}
                            portalOpen={portalStatus.isOpen}
                            onSelect={r => setActiveRoom(r)}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Compact Quick Blueprint Matrix Mode */
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                        {rooms.map(room => {
                          const isMaintenance = room.capacity === 0;
                          const isFull = room.capacity > 0 && room.current_count >= room.capacity;
                          const isLocked = building.is_locked || room.is_locked;
                          const isDisabled = !portalStatus.isOpen || isMaintenance || isFull || isLocked;
                          const effGender = room.fixed_gender ?? room.gender_type;
                          const pct = room.capacity > 0 ? Math.min(100, Math.round((room.current_count / room.capacity) * 100)) : 0;

                          return (
                            <button
                              key={room.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setActiveRoom(room)}
                              className={cn(
                                "rounded-2xl border p-3.5 text-left transition-all",
                                isDisabled
                                  ? "border-black/10 bg-stone-200/70 text-stone-500 cursor-not-allowed"
                                  : "border-black/12 bg-white hover:-translate-y-0.5 hover:border-[#c8102e] hover:shadow-md cursor-pointer"
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-base font-extrabold text-[#111114]">
                                  {room.room_code}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-xs font-bold",
                                    effGender === "MALE"
                                      ? "bg-sky-100 text-sky-800"
                                      : effGender === "FEMALE"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  )}
                                >
                                  {effGender === "MALE" ? "Nam" : effGender === "FEMALE" ? "Nữ" : "Trống"}
                                </span>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between text-sm font-bold">
                                <span className={isFull ? "text-[#c8102e]" : "text-emerald-700"}>
                                  {room.current_count}/{room.capacity} chỗ
                                </span>
                                <span className="text-xs text-stone-500">
                                  {(room.price / 1000).toFixed(0)}k
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    isFull ? "bg-[#c8102e]" : "bg-emerald-600"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* ── FLOATING LIVE REFRESH ── */}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={refreshCooldown > 0}
        className={cn(
          "fixed bottom-6 right-5 z-40 flex items-center gap-2.5 rounded-full px-5 py-3.5 text-[15px] font-extrabold text-white shadow-xl transition-all sm:right-8",
          refreshCooldown > 0
            ? "bg-stone-700 shadow-none cursor-not-allowed"
            : "bg-[#c8102e] shadow-red-600/35 hover:bg-[#a50d26] animate-pulse-ring"
        )}
      >
        <RefreshCw className={cn("h-4 w-4", refreshCooldown > 0 && "animate-spin")} />
        {refreshCooldown > 0 ? `Chờ ${refreshCooldown}s` : "Cập nhật phòng trống"}
      </button>

      {activeRoom && data && (
        <RegistrationModal
          room={activeRoom}
          building={buildingsMap.get(activeRoom.building_id)}
          dynamicFields={data.system_config.dynamic_fields}
          onClose={() => setActiveRoom(null)}
          onRoomStale={handleRoomStale}
          onSuccessRefresh={fetchRooms}
        />
      )}
    </div>
  );
}
