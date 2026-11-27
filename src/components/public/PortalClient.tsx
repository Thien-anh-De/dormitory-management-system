"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Clock,
  Filter,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { PublicRoom, PublicRoomsPayload } from "@/lib/types";
import { RoomCard } from "./RoomCard";
import { RegistrationModal } from "./RegistrationModal";
import { cn } from "@/lib/utils";

function formatTimeHHMMSS(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour12: false });
}

function getCountdownParts(ms: number) {
  if (ms <= 0) return { days: 0, hrs: "00", mins: "00", secs: "00" };
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, "0");
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

  // Client-side filters
  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [searchRoom, setSearchRoom] = useState("");

  // Selected room for registration modal
  const [activeRoom, setActiveRoom] = useState<PublicRoom | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      // NEVER append ?t=Date.now() so Vercel Edge Cache 3s hits 100%
      const res = await fetch("/api/public/rooms", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as PublicRoomsPayload;
      setData(json);
    } catch {
      setToastMsg("Không thể tải danh sách phòng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/rooms", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json() as Promise<PublicRoomsPayload>;
      })
      .then((json) => {
        if (active) setData(json);
      })
      .catch(() => {
        if (active) setToastMsg("Không thể tải danh sách phòng. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Countdown clock every 1s
  useEffect(() => {
    const initId = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, []);

  // Cooldown timer for refresh button (3s -> 2s -> 1s)
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const id = setTimeout(() => setRefreshCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [refreshCooldown]);

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(3);
    fetchRooms();
  };

  // Optimistic update when a registration fails due to stale 3s cache
  const handleRoomStale = (roomId: string, errorCode: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rooms: prev.rooms.map((r) => {
          if (r.id !== roomId) return r;
          if (errorCode === "ROOM_FULL") {
            return { ...r, current_count: r.capacity };
          }
          if (errorCode === "ROOM_LOCKED") {
            return { ...r, is_locked: true };
          }
          return r;
        }),
      };
    });
    fetchRooms();
  };

  const portalStatus = useMemo(() => {
    if (!data) return { isOpen: false, reason: "Đang tải..." };
    const cfg = data.system_config;
    if (!data.active_wave) {
      return { isOpen: false, reason: "Hiện chưa có đợt đăng ký nào đang mở." };
    }
    if (!cfg.is_portal_open) {
      return { isOpen: false, reason: "Cổng đăng ký hiện đang tạm đóng." };
    }
    if (nowMs > 0 && cfg.open_at && nowMs < new Date(cfg.open_at).getTime()) {
      const diff = new Date(cfg.open_at).getTime() - nowMs;
      return {
        isOpen: false,
        countdownParts: getCountdownParts(diff),
        reason: "Cổng đăng ký chưa đến giờ mở.",
      };
    }
    if (nowMs > 0 && cfg.close_at && nowMs > new Date(cfg.close_at).getTime()) {
      return { isOpen: false, reason: "Đã hết thời gian đăng ký cho đợt này." };
    }
    return { isOpen: true, reason: "" };
  }, [data, nowMs]);

  const buildingsMap = useMemo(() => {
    const m = new Map<
      string,
      NonNullable<typeof data>["buildings"][number]
    >();
    for (const b of data?.buildings ?? []) m.set(b.id, b);
    return m;
  }, [data]);

  const amenitiesMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["amenities"][number]>();
    for (const a of data?.amenities ?? []) m.set(a.id, a);
    return m;
  }, [data]);

  const summaryStats = useMemo(() => {
    if (!data) return { totalRooms: 0, openBeds: 0 };
    let openBeds = 0;
    for (const r of data.rooms) {
      const b = buildingsMap.get(r.building_id);
      if (!r.is_locked && !b?.is_locked && r.capacity > 0) {
        openBeds += Math.max(0, r.capacity - r.current_count);
      }
    }
    return { totalRooms: data.rooms.length, openBeds };
  }, [data, buildingsMap]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const keyword = searchRoom.trim().toLowerCase();
    return data.rooms.filter((room) => {
      if (selectedBuilding !== "ALL" && room.building_id !== selectedBuilding) {
        return false;
      }
      const effGender = room.fixed_gender ?? room.gender_type;
      if (genderFilter !== "ALL" && effGender !== genderFilter) {
        return false;
      }
      if (onlyAvailable) {
        const b = buildingsMap.get(room.building_id);
        if (
          room.capacity === 0 ||
          room.current_count >= room.capacity ||
          room.is_locked ||
          b?.is_locked
        ) {
          return false;
        }
      }
      if (selectedAmenities.length > 0) {
        const hasAll = selectedAmenities.every((id) =>
          room.amenity_ids.includes(id)
        );
        if (!hasAll) return false;
      }
      if (keyword && !room.room_code.toLowerCase().includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [
    data,
    selectedBuilding,
    genderFilter,
    onlyAvailable,
    selectedAmenities,
    searchRoom,
    buildingsMap,
  ]);

  const hasActiveFilters =
    selectedBuilding !== "ALL" ||
    genderFilter !== "ALL" ||
    selectedAmenities.length > 0 ||
    onlyAvailable ||
    searchRoom.trim() !== "";

  const resetFilters = () => {
    setSelectedBuilding("ALL");
    setGenderFilter("ALL");
    setSelectedAmenities([]);
    setOnlyAvailable(false);
    setSearchRoom("");
  };

  // Group rooms by Building -> Floor
  const grouped = useMemo(() => {
    if (!data) return [];
    const byBuilding = new Map<string, Map<number, PublicRoom[]>>();
    for (const room of filteredRooms) {
      let floors = byBuilding.get(room.building_id);
      if (!floors) {
        floors = new Map();
        byBuilding.set(room.building_id, floors);
      }
      const list = floors.get(room.floor) ?? [];
      list.push(room);
      floors.set(room.floor, list);
    }

    return data.buildings
      .filter((b) => byBuilding.has(b.id))
      .map((b) => {
        const floorsMap = byBuilding.get(b.id)!;
        const floors = Array.from(floorsMap.entries())
          .sort(([f1], [f2]) => f1 - f2)
          .map(([floor, rooms]) => ({ floor, rooms }));
        return { building: b, floors };
      });
  }, [data, filteredRooms]);

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="h-36 animate-pulse rounded-2xl bg-gradient-to-r from-indigo-200 to-violet-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-52 animate-pulse rounded-2xl border border-indigo-100 bg-white p-5"
            >
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-3 w-full rounded bg-slate-100" />
              <div className="mt-6 h-10 w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Hero Banner */}
      <section className="overflow-hidden rounded-2xl border border-indigo-200/60 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-5 py-6 text-white sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {data?.active_wave ? data.active_wave.name : "Chưa mở đợt"}
                </span>
                {portalStatus.isOpen && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                    Đang mở đăng ký
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Sơ đồ Phòng Ký túc xá HANU
              </h1>
              <p className="mt-1 text-xs text-indigo-100 sm:text-sm">
                Chọn phòng phù hợp và hoàn tất phiếu đăng ký trực tuyến nhanh chóng.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="rounded-xl bg-white/15 px-3.5 py-2 text-right backdrop-blur-sm">
                <p className="text-[11px] font-medium text-indigo-100">
                  Chỗ trống hiện tại
                </p>
                <p className="text-lg font-extrabold leading-tight">
                  {summaryStats.openBeds} chỗ
                </p>
              </div>
              {data?.fetched_at && (
                <div className="rounded-xl bg-white/15 px-3.5 py-2 text-right backdrop-blur-sm">
                  <p className="text-[11px] font-medium text-indigo-100">
                    Cập nhật lúc
                  </p>
                  <p className="font-mono text-sm font-bold leading-tight">
                    {formatTimeHHMMSS(data.fetched_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {!portalStatus.isOpen && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-100">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" />
                <span>{portalStatus.reason}</span>
              </div>
              {portalStatus.countdownParts && (
                <div className="flex items-center gap-1.5">
                  <Clock className="mr-1 h-4 w-4 text-indigo-200" />
                  {portalStatus.countdownParts.days > 0 && (
                    <span className="rounded-lg bg-slate-950/40 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {portalStatus.countdownParts.days} ngày
                    </span>
                  )}
                  <span className="rounded-lg bg-slate-950/40 px-2.5 py-1 font-mono text-sm font-bold text-white">
                    {portalStatus.countdownParts.hrs}
                  </span>
                  <span className="font-bold text-indigo-200">:</span>
                  <span className="rounded-lg bg-slate-950/40 px-2.5 py-1 font-mono text-sm font-bold text-white">
                    {portalStatus.countdownParts.mins}
                  </span>
                  <span className="font-bold text-indigo-200">:</span>
                  <span className="rounded-lg bg-slate-950/40 px-2.5 py-1 font-mono text-sm font-bold text-white">
                    {portalStatus.countdownParts.secs}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {data?.system_config.announcement && (
          <div className="flex items-start gap-3 border-t border-amber-100 bg-amber-50/80 px-5 py-3.5 text-sm text-amber-950 sm:px-7">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="whitespace-pre-line leading-relaxed">
              {data.system_config.announcement}
            </p>
          </div>
        )}
      </section>

      {toastMsg && (
        <div className="animate-shake rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {toastMsg}
        </div>
      )}

      {/* Client-side Instant Filters */}
      <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <Filter className="h-3.5 w-3.5" />
            Bộ lọc nhanh
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold normal-case text-indigo-700">
              {filteredRooms.length} phòng
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <RotateCcw className="h-3 w-3" />
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              placeholder="Tìm mã phòng (VD: 201D10)..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
            {searchRoom && (
              <button
                type="button"
                onClick={() => setSearchRoom("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="ALL">Tất cả tòa nhà</option>
            {(data?.buildings ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="ALL">Tất cả giới tính</option>
            <option value="MALE">Phòng Nam</option>
            <option value="FEMALE">Phòng Nữ</option>
            <option value="EMPTY">Phòng Trống (chưa có người)</option>
          </select>

          <button
            type="button"
            role="switch"
            aria-checked={onlyAvailable}
            onClick={() => setOnlyAvailable((v) => !v)}
            className={cn(
              "flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3.5 text-sm font-medium transition",
              onlyAvailable
                ? "border-indigo-300 bg-indigo-50/70 text-indigo-800"
                : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/70"
            )}
          >
            <span>Chỉ hiện phòng còn chỗ</span>
            <span
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                onlyAvailable ? "bg-indigo-600" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  onlyAvailable ? "translate-x-6" : "translate-x-1"
                )}
              />
            </span>
          </button>
        </div>

        {(data?.amenities.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 text-xs font-semibold text-slate-500">
              Tiện ích:
            </span>
            {data?.amenities.map((a) => {
              const active = selectedAmenities.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                    active
                      ? "border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                  )}
                >
                  {a.icon && <span>{a.icon}</span>}
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Room List Grouped by Building -> Floor */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <BedDouble className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {data?.rooms.length === 0
              ? "Chưa có dữ liệu phòng nào trong hệ thống."
              : "Không tìm thấy phòng nào khớp với bộ lọc hiện tại."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ building, floors }) => (
            <section key={building.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-extrabold text-indigo-700">
                    {building.code}
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                    {building.name}
                  </h2>
                </div>
                {building.is_locked && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Tòa đang khóa
                  </span>
                )}
              </div>

              {floors.map(({ floor, rooms }) => (
                <div key={floor} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-700">
                      Tầng {floor}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {rooms.length} phòng
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        buildingLocked={building.is_locked}
                        amenitiesMap={amenitiesMap}
                        portalOpen={portalStatus.isOpen}
                        onSelect={(r) => setActiveRoom(r)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Floating Refresh Button with 3s Cooldown */}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={refreshCooldown > 0}
        className={cn(
          "fixed bottom-5 right-4 z-40 flex min-h-[48px] items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none sm:right-6",
          refreshCooldown === 0 && "animate-pulse-ring"
        )}
      >
        <RefreshCw
          className={`h-4 w-4 ${refreshCooldown > 0 ? "animate-spin" : ""}`}
        />
        {refreshCooldown > 0
          ? `Chờ ${refreshCooldown}s...`
          : "Cập nhật phòng trống"}
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
