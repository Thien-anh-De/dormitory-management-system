"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  Filter,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldOff,
  SlidersHorizontal,
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
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchRoom, setSearchRoom] = useState("");
  const [activeRoom, setActiveRoom] = useState<PublicRoom | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/public/rooms", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
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
      return { isOpen: false, countdownParts: getCountdownParts(new Date(cfg.open_at).getTime() - nowMs), reason: "Cổng đăng ký chưa đến giờ mở." };
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
    if (!data) return { total: 0, available: 0, full: 0 };
    let available = 0, full = 0;
    for (const r of data.rooms) {
      const b = buildingsMap.get(r.building_id);
      if (!r.is_locked && !b?.is_locked && r.capacity > 0) {
        if (r.current_count < r.capacity) available++;
        else full++;
      }
    }
    return { total: data.rooms.length, available, full };
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
      .map(b => ({
        building: b,
        floors: Array.from(byB.get(b.id)!.entries())
          .sort(([a], [c]) => a - c)
          .map(([floor, rooms]) => ({ floor, rooms })),
      }));
  }, [data, filteredRooms]);

  const toggleAmenity = (id: string) =>
    setSelectedAmenities(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="skeleton h-52 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden rounded-2xl bg-black text-white">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #dc2626 0%, transparent 50%), radial-gradient(circle at 80% 20%, #991b1b 0%, transparent 40%)" }} />
        <div className="absolute top-0 right-0 h-full w-1/3 opacity-5"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />

        <div className="relative px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-red-500/40 bg-red-600/20 px-3 py-1 text-xs font-bold tracking-wider text-red-300 uppercase">
                  {data?.active_wave?.name ?? "Chưa mở đợt"}
                </span>
                {portalStatus.isOpen && (
                  <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 border border-green-500/30 px-3 py-1 text-xs font-bold text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    Đang mở
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Sơ đồ Phòng<br />
                <span className="text-red-500">Ký túc xá HANU</span>
              </h1>
              <p className="text-sm text-white/60 max-w-md">
                Chọn phòng phù hợp và hoàn tất phiếu đăng ký trực tuyến trong vài bước đơn giản.
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Tổng phòng", value: stats.total },
                { label: "Còn chỗ", value: stats.available, red: true },
                { label: "Đã đầy", value: stats.full },
              ].map(s => (
                <div key={s.label} className={cn(
                  "rounded-xl border p-3 text-center min-w-[80px]",
                  s.red
                    ? "border-red-500/40 bg-red-600/15"
                    : "border-white/10 bg-white/5"
                )}>
                  <p className={cn("text-2xl font-black", s.red ? "text-red-400" : "text-white")}>{s.value}</p>
                  <p className="text-[11px] font-semibold text-white/50 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Closed portal */}
          {!portalStatus.isOpen && (
            <div className="mt-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-300">
                <ShieldOff className="h-5 w-5 shrink-0" />
                {portalStatus.reason}
              </div>
              {portalStatus.countdownParts && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/40" />
                  <div className="flex items-center gap-1.5 font-mono text-sm font-black">
                    {portalStatus.countdownParts.days > 0 && (
                      <><span className="rounded-lg bg-white/10 px-2.5 py-1">{portalStatus.countdownParts.days}d</span><span className="text-white/30">:</span></>
                    )}
                    <span className="rounded-lg bg-red-600 px-2.5 py-1">{portalStatus.countdownParts.hrs}</span>
                    <span className="text-white/30">:</span>
                    <span className="rounded-lg bg-red-600 px-2.5 py-1">{portalStatus.countdownParts.mins}</span>
                    <span className="text-white/30">:</span>
                    <span className="rounded-lg bg-red-600 px-2.5 py-1">{portalStatus.countdownParts.secs}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Announcement */}
          {data?.system_config.announcement && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="whitespace-pre-line leading-relaxed">{data.system_config.announcement}</p>
            </div>
          )}

          {/* Last updated */}
          {data?.fetched_at && (
            <p className="mt-4 text-xs text-white/35">
              Cập nhật lần cuối lúc{" "}
              <span className="font-mono font-semibold text-white/60">{formatTimeHHMMSS(data.fetched_at)}</span>
            </p>
          )}
        </div>
      </section>

      {toastMsg && (
        <div className="animate-shake flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <section className="rounded-2xl border border-black/8 bg-white shadow-sm">
        <div
          className="flex cursor-pointer items-center justify-between px-4 py-3.5 sm:px-5"
          onClick={() => setFiltersOpen(v => !v)}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-black">
            <SlidersHorizontal className="h-4 w-4 text-red-600" />
            Bộ lọc
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700">
              {filteredRooms.length} phòng
            </span>
            {hasActiveFilters && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                Đang lọc
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setSelectedBuilding("ALL"); setGenderFilter("ALL"); setSelectedAmenities([]); setOnlyAvailable(false); setSearchRoom(""); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-black"
              >
                <RotateCcw className="h-3 w-3" />
                Đặt lại
              </button>
            )}
            <Filter className={cn("h-4 w-4 text-gray-400 transition-transform", filtersOpen ? "rotate-180" : "")} />
          </div>
        </div>

        {filtersOpen && (
          <div className="border-t border-black/6 p-4 sm:p-5 space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchRoom}
                  onChange={e => setSearchRoom(e.target.value)}
                  placeholder="Tìm mã phòng..."
                  className="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-9 text-sm transition focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/15"
                />
                {searchRoom && (
                  <button onClick={() => setSearchRoom("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={selectedBuilding}
                onChange={e => setSelectedBuilding(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm font-medium transition focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/15"
              >
                <option value="ALL">Tất cả tòa nhà</option>
                {(data?.buildings ?? []).map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>

              <select
                value={genderFilter}
                onChange={e => setGenderFilter(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm font-medium transition focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/15"
              >
                <option value="ALL">Tất cả giới tính</option>
                <option value="MALE">Phòng Nam</option>
                <option value="FEMALE">Phòng Nữ</option>
                <option value="EMPTY">Phòng trống chưa xác định</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyAvailable(v => !v)}
                className={cn(
                  "flex min-h-[42px] items-center justify-between rounded-xl border px-4 text-sm font-semibold transition",
                  onlyAvailable ? "border-red-600 bg-red-600 text-white" : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                )}
              >
                Chỉ còn chỗ trống
                <span className={cn("relative ml-3 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", onlyAvailable ? "bg-white/30" : "bg-gray-300")}>
                  <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", onlyAvailable ? "translate-x-4" : "translate-x-0")} />
                </span>
              </button>
            </div>

            {(data?.amenities.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tiện ích:</span>
                {data!.amenities.map(a => {
                  const on = selectedAmenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                        on ? "border-red-600 bg-red-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                      )}
                    >
                      {a.icon && <span>{a.icon}</span>}
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── ROOM GRID ── */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-14 text-center">
          <p className="text-sm font-bold text-gray-500">
            {data?.rooms.length === 0 ? "Chưa có dữ liệu phòng nào trong hệ thống." : "Không tìm thấy phòng nào khớp với bộ lọc."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ building, floors }) => (
            <section key={building.id}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 rounded-full bg-red-600" />
                  <h2 className="text-xl font-black tracking-tight text-black">
                    {building.name}
                    <span className="ml-2 text-sm font-bold text-gray-400">({building.code})</span>
                  </h2>
                </div>
                {building.is_locked && (
                  <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white">
                    Khóa
                  </span>
                )}
              </div>

              {floors.map(({ floor, rooms }) => (
                <div key={floor} className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-md bg-black px-2.5 py-0.5 text-xs font-black text-white">Tầng {floor}</span>
                    <span className="text-xs text-gray-500 font-medium">{rooms.length} phòng</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* ── FLOATING REFRESH ── */}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={refreshCooldown > 0}
        className={cn(
          "fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white shadow-xl transition-all sm:right-8",
          refreshCooldown > 0
            ? "bg-gray-700 shadow-none cursor-not-allowed"
            : "bg-red-600 shadow-red-500/40 hover:bg-red-700 animate-pulse-ring"
        )}
      >
        <RefreshCw className={cn("h-4 w-4", refreshCooldown > 0 && "animate-spin")} />
        {refreshCooldown > 0 ? `${refreshCooldown}s` : "Cập nhật"}
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
