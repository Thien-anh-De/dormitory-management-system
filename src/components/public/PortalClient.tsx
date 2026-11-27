"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Filter,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import type { PublicRoom, PublicRoomsPayload } from "@/lib/types";
import { RoomCard } from "./RoomCard";
import { RegistrationModal } from "./RegistrationModal";

function formatTimeHHMMSS(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour12: false });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days > 0
    ? `${days} ngày ${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
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
    fetchRooms();
  }, [fetchRooms]);

  // Countdown clock every 1s
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
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
        countdown: formatCountdown(diff),
        reason: "Cổng đăng ký chưa đến giờ mở.",
      };
    }
    if (nowMs > 0 && cfg.close_at && nowMs > new Date(cfg.close_at).getTime()) {
      return { isOpen: false, reason: "Đã hết thời gian đăng ký cho đợt này." };
    }
    return { isOpen: true, reason: "" };
  }, [data, nowMs]);

  const buildingsMap = useMemo(() => {
    const m = new Map<string, (typeof data extends null ? never : NonNullable<typeof data>["buildings"][number])>();
    for (const b of data?.buildings ?? []) m.set(b.id, b);
    return m;
  }, [data]);

  const amenitiesMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["amenities"][number]>();
    for (const a of data?.amenities ?? []) m.set(a.id, a);
    return m;
  }, [data]);

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
      <div className="space-y-4 py-8 text-center text-sm text-slate-500">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p>Đang tải danh sách phòng ký túc xá...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Wave & Portal Status Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {data?.active_wave ? data.active_wave.name : "Chưa mở đợt"}
            </span>
            <h1 className="mt-1.5 text-xl font-bold text-slate-900 sm:text-2xl">
              Sơ đồ Phòng Ký túc xá
            </h1>
          </div>

          {data?.fetched_at && (
            <p className="text-xs text-slate-500">
              Cập nhật lần cuối:{" "}
              <strong className="text-slate-700">
                {formatTimeHHMMSS(data.fetched_at)}
              </strong>
            </p>
          )}
        </div>

        {!portalStatus.isOpen && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
              <span>{portalStatus.reason}</span>
            </div>
            {portalStatus.countdown && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-bold text-amber-700 shadow-sm">
                <Clock className="h-4 w-4" />
                Mở sau: {portalStatus.countdown}
              </div>
            )}
          </div>
        )}

        {data?.system_config.announcement && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-sm text-blue-950">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="whitespace-pre-line">{data.system_config.announcement}</p>
          </div>
        )}
      </section>

      {toastMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {toastMsg}
        </div>
      )}

      {/* Client-side Instant Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Bộ lọc nhanh
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              placeholder="Tìm mã phòng (VD: 201D10)..."
              className="min-h-[44px] w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
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
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">Tất cả giới tính</option>
            <option value="MALE">Phòng Nam</option>
            <option value="FEMALE">Phòng Nữ</option>
            <option value="EMPTY">Phòng Trống (chưa có người)</option>
          </select>

          <label className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <span>Chỉ hiện phòng còn chỗ</span>
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
          </label>
        </div>

        {(data?.amenities.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 text-xs font-medium text-slate-500">Tiện ích:</span>
            {data?.amenities.map((a) => {
              const active = selectedAmenities.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Room List Grouped by Building -> Floor */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {data?.rooms.length === 0
            ? "Chưa có dữ liệu phòng nào trong hệ thống."
            : "Không tìm thấy phòng nào khớp với bộ lọc hiện tại."}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ building, floors }) => (
            <section key={building.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {building.name}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    ({building.code})
                  </span>
                </h2>
                {building.is_locked && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    Tòa đang khóa
                  </span>
                )}
              </div>

              {floors.map(({ floor, rooms }) => (
                <div key={floor} className="space-y-2.5">
                  <h3 className="text-sm font-semibold text-slate-600">
                    Tầng {floor} ({rooms.length} phòng)
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        className="fixed bottom-5 right-4 z-40 flex min-h-[48px] items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500 sm:right-6"
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
