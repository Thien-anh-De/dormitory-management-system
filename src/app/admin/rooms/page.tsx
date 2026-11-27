"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Grid2x2,
  LayoutGrid,
  Lock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import type { Amenity, Building, PublicRoom } from "@/lib/types";
import { BulkRoomGeneratorModal } from "@/components/admin/BulkRoomGeneratorModal";
import { RoomDetailDrawer } from "@/components/admin/RoomDetailDrawer";
import { cn } from "@/lib/utils";

export default function AdminRoomsPage() {
  const [tab, setTab] = useState<"GRID" | "MASTER">("GRID");
  const [viewMode, setViewMode] = useState<"CARDS" | "COMPACT">("CARDS");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "FULL" | "OVER" | "LOCKED">("ALL");
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [modalBuildingId, setModalBuildingId] = useState<string | undefined>(undefined);
  const [drawerRoom, setDrawerRoom] = useState<PublicRoom | null>(null);

  // Master Data forms
  const [bCode, setBCode] = useState("");
  const [bName, setBName] = useState("");
  const [bSort, setBSort] = useState(1);
  const [aName, setAName] = useState("");
  const [masterError, setMasterError] = useState<string | null>(null);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editBName, setEditBName] = useState("");
  const [editBSort, setEditBSort] = useState(1);

  // Bulk Action inputs
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCapacity, setBulkCapacity] = useState("");
  const [bulkAmenityId, setBulkAmenityId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/rooms");
    if (res.ok) {
      const json = await res.json();
      const bList = json.buildings ?? [];
      setBuildings(bList);
      setAmenities(json.amenities ?? []);
      setRooms(json.rooms ?? []);
      setBSort(bList.length + 1);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/rooms")
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!active || !json) return;
        const bList = json.buildings ?? [];
        setBuildings(bList);
        setAmenities(json.amenities ?? []);
        setRooms(json.rooms ?? []);
        setBSort(bList.length + 1);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const buildingLockedMap = useMemo(
    () => new Map(buildings.map(b => [b.id, b.is_locked])),
    [buildings]
  );

  const roomCounts = useMemo(() => {
    let available = 0;
    let full = 0;
    let over = 0;
    let locked = 0;
    for (const r of rooms) {
      const bLocked = buildingLockedMap.get(r.building_id) ?? false;
      if (bLocked || r.is_locked || r.capacity === 0) locked++;
      else if (r.current_count > r.capacity) over++;
      else if (r.current_count === r.capacity) full++;
      else available++;
    }
    return { total: rooms.length, available, full, over, locked };
  }, [rooms, buildingLockedMap]);

  const filteredRooms = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rooms.filter(r => {
      if (buildingFilter !== "ALL" && r.building_id !== buildingFilter) return false;
      if (kw && !r.room_code.toLowerCase().includes(kw)) return false;
      if (statusFilter !== "ALL") {
        const bLocked = buildingLockedMap.get(r.building_id) ?? false;
        const isLocked = bLocked || r.is_locked || r.capacity === 0;
        const isOver = !isLocked && r.current_count > r.capacity;
        const isFull = !isLocked && r.current_count === r.capacity;
        const isAvail = !isLocked && r.current_count < r.capacity;
        if (statusFilter === "LOCKED" && !isLocked) return false;
        if (statusFilter === "OVER" && !isOver) return false;
        if (statusFilter === "FULL" && !isFull) return false;
        if (statusFilter === "AVAILABLE" && !isAvail) return false;
      }
      return true;
    });
  }, [rooms, search, buildingFilter, statusFilter, buildingLockedMap]);

  const grouped = useMemo(() => {
    const byB = new Map<string, Map<number, PublicRoom[]>>();
    for (const r of filteredRooms) {
      let floors = byB.get(r.building_id);
      if (!floors) {
        floors = new Map();
        byB.set(r.building_id, floors);
      }
      const arr = floors.get(r.floor) ?? [];
      arr.push(r);
      floors.set(r.floor, arr);
    }
    return buildings
      .filter(b => byB.has(b.id))
      .map(b => ({
        building: b,
        floors: Array.from(byB.get(b.id)!.entries())
          .sort(([f1], [f2]) => f1 - f2)
          .map(([floor, list]) => ({ floor, rooms: list })),
      }));
  }, [buildings, filteredRooms]);

  function toggleRoomSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRoomGroup(list: PublicRoom[]) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = list.every(r => next.has(r.id));
      for (const r of list) {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  async function runBulkPatch(payload: Record<string, unknown>) {
    if (selectedIds.size === 0) return;
    await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_ids: Array.from(selectedIds),
        ...payload,
      }),
    });
    setSelectedIds(new Set());
    await loadData();
  }

  async function handleToggleBuildingLock(b: Building) {
    await fetch("/api/admin/buildings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, is_locked: !b.is_locked }),
    });
    await loadData();
  }

  async function handleCreateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!bCode.trim() || !bName.trim()) return;
    setMasterError(null);
    const res = await fetch("/api/admin/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: bCode.trim(), name: bName.trim(), sort_order: bSort }),
    });
    if (res.ok) {
      setBCode("");
      setBName("");
      await loadData();
    } else {
      const j = await res.json().catch(() => ({}));
      setMasterError(j.error ?? "Không thể thêm tòa nhà (có thể mã tòa đã tồn tại).");
    }
  }

  async function handleSaveBuildingEdit(id: string) {
    if (!editBName.trim()) return;
    setMasterError(null);
    const res = await fetch("/api/admin/buildings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editBName.trim(), sort_order: editBSort }),
    });
    if (res.ok) {
      setEditingBuildingId(null);
      await loadData();
    } else {
      const j = await res.json().catch(() => ({}));
      setMasterError(j.error ?? "Không thể cập nhật tòa nhà.");
    }
  }

  async function handleDeleteBuilding(id: string) {
    if (!confirm("Xóa tòa nhà sẽ xóa toàn bộ phòng thuộc tòa đó. Tiếp tục?")) return;
    await fetch(`/api/admin/buildings?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function createAmenityByName(name: string) {
    if (!name.trim()) return;
    setMasterError(null);
    const res = await fetch("/api/admin/amenities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setAName("");
      await loadData();
    } else {
      const j = await res.json().catch(() => ({}));
      setMasterError(j.error ?? "Không thể thêm tiện ích.");
    }
  }

  async function handleCreateAmenity(e: React.FormEvent) {
    e.preventDefault();
    await createAmenityByName(aName);
  }

  async function handleDeleteAmenity(id: string) {
    await fetch(`/api/admin/amenities?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Header + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
            Quản lý Phòng ({rooms.length}) & Danh mục
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Tạo phòng hàng loạt, khóa/mở phòng theo tầng/tòa và cấu hình tiện ích.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-black/10 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setTab("GRID")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm sm:text-[15px] font-bold transition",
                tab === "GRID" ? "bg-[#111114] text-white shadow-sm" : "text-stone-600 hover:text-[#111114]"
              )}
            >
              Bản đồ phòng
            </button>
            <button
              type="button"
              onClick={() => setTab("MASTER")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm sm:text-[15px] font-bold transition",
                tab === "MASTER" ? "bg-[#111114] text-white shadow-sm" : "text-stone-600 hover:text-[#111114]"
              )}
            >
              Tòa nhà & Tiện ích
            </button>
          </div>

          <button
            type="button"
            disabled={buildings.length === 0}
            onClick={() => {
              setModalBuildingId(undefined);
              setShowBulkModal(true);
            }}
            className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#c8102e] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 hover:bg-[#a50d26] disabled:bg-stone-400 disabled:shadow-none transition"
          >
            <Sparkles className="h-4 w-4" />
            Thêm / Tạo phòng
          </button>
        </div>
      </div>

      {tab === "GRID" ? (
        <>
          {/* 5-Tile Bento Status Filter */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { key: "ALL", label: "Tổng số phòng", count: roomCounts.total, cls: "border-black/10 bg-white text-[#111114]" },
              { key: "AVAILABLE", label: "Còn trống", count: roomCounts.available, cls: "border-emerald-200 bg-emerald-50 text-emerald-900" },
              { key: "FULL", label: "Đã đầy", count: roomCounts.full, cls: "border-red-200 bg-red-50 text-red-900" },
              { key: "OVER", label: "Vượt sức chứa", count: roomCounts.over, cls: "border-amber-200 bg-amber-50 text-amber-900" },
              { key: "LOCKED", label: "Khóa / Bảo trì", count: roomCounts.locked, cls: "border-stone-300 bg-stone-200/70 text-stone-800" },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition shadow-xs hover:-translate-y-0.5",
                  item.cls,
                  statusFilter === item.key && "ring-2 ring-[#c8102e] shadow-md"
                )}
              >
                <p className="text-sm font-bold opacity-80">{item.label}</p>
                <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">{item.count}</p>
              </button>
            ))}
          </div>

          {/* Search, Building Select & View Mode Bar */}
          <div className="bento-card flex flex-wrap items-center justify-between gap-4 rounded-3xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm mã phòng..."
                  className="min-h-[46px] rounded-2xl border border-black/12 bg-[#f6f5f2] pl-10 pr-4 text-[15px] font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={buildingFilter}
                onChange={e => setBuildingFilter(e.target.value)}
                className="min-h-[46px] rounded-2xl border border-black/12 bg-[#f6f5f2] px-4 text-[15px] font-semibold focus:border-[#c8102e] focus:bg-white focus:outline-none"
              >
                <option value="ALL">Tất cả tòa nhà</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-2xl bg-[#f6f5f2] p-1 border border-black/8">
                <button
                  type="button"
                  onClick={() => setViewMode("CARDS")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition",
                    viewMode === "CARDS" ? "bg-white text-[#111114] shadow-xs" : "text-stone-500"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" /> Chi tiết
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("COMPACT")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition",
                    viewMode === "COMPACT" ? "bg-white text-[#111114] shadow-xs" : "text-stone-500"
                  )}
                >
                  <Grid2x2 className="h-4 w-4" /> Ma trận 300P
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-stone-700">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" /> Còn trống
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#c8102e]" /> Đầy
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400" /> Vượt chỗ
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-stone-500" /> Khóa/Bảo trì
              </span>
            </div>
          </div>

          {/* 300 Rooms Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="bento-card rounded-3xl border-2 border-dashed border-black/15 p-12 text-center text-base font-bold text-stone-500">
              Chưa có phòng nào. Hãy bấm &quot;Thêm / Tạo phòng&quot; để khởi tạo!
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ building, floors }) => {
                const buildingRooms = floors.flatMap(f => f.rooms);
                return (
                  <div key={building.id} className="bento-card rounded-3xl p-5 sm:p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-xl bg-[#111114] px-3 py-1 font-mono text-base font-extrabold text-white">
                          {building.code}
                        </span>
                        <h2 className="text-xl font-extrabold text-[#111114]">
                          {building.name}
                        </h2>
                        <button
                          type="button"
                          onClick={() => selectRoomGroup(buildingRooms)}
                          className="rounded-xl border border-black/12 bg-[#f6f5f2] px-3 py-1.5 text-sm font-bold text-stone-700 hover:bg-stone-200 transition"
                        >
                          Chọn cả tòa ({buildingRooms.length})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleBuildingLock(building)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
                          building.is_locked
                            ? "bg-red-100 text-[#c8102e] hover:bg-red-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                        )}
                      >
                        {building.is_locked ? (
                          <>
                            <Lock className="h-4 w-4" /> Tòa đang khóa (Bấm mở)
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4" /> Tòa đang mở (Bấm khóa)
                          </>
                        )}
                      </button>
                    </div>

                    {floors.map(({ floor, rooms: fRooms }) => {
                      const floorKey = `${building.id}-${floor}`;
                      const collapsed = collapsedFloors.has(floorKey);
                      return (
                        <div key={floorKey} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedFloors(prev => {
                                  const next = new Set(prev);
                                  if (next.has(floorKey)) next.delete(floorKey);
                                  else next.add(floorKey);
                                  return next;
                                })
                              }
                              className="flex items-center gap-1.5 rounded-xl bg-[#f6f5f2] px-3 py-1.5 text-[15px] font-extrabold text-[#111114] hover:bg-stone-200 transition"
                            >
                              {collapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              Tầng {floor} ({fRooms.length} phòng)
                            </button>
                            <button
                              type="button"
                              onClick={() => selectRoomGroup(fRooms)}
                              className="text-sm font-bold text-[#c8102e] hover:underline"
                            >
                              Chọn tầng này
                            </button>
                          </div>

                          {!collapsed && (
                            <div
                              className={cn(
                                "grid gap-3",
                                viewMode === "COMPACT"
                                  ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10"
                                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                              )}
                            >
                              {fRooms.map(r => {
                                const isLocked = building.is_locked || r.is_locked || r.capacity === 0;
                                const isOver = r.current_count > r.capacity && r.capacity > 0;
                                const isFull = r.capacity > 0 && r.current_count === r.capacity;
                                const checked = selectedIds.has(r.id);
                                const pct = r.capacity > 0 ? Math.min(100, Math.round((r.current_count / r.capacity) * 100)) : 0;

                                return (
                                  <div
                                    key={r.id}
                                    className={cn(
                                      "relative rounded-2xl border p-3.5 transition cursor-pointer hover:shadow-md",
                                      isLocked
                                        ? "border-stone-300 bg-stone-100 text-stone-700"
                                        : isOver
                                        ? "border-amber-300 bg-amber-50 text-amber-950"
                                        : isFull
                                        ? "border-red-300 bg-red-50 text-red-950"
                                        : "border-emerald-300 bg-emerald-50/80 text-emerald-950",
                                      checked && "ring-2 ring-[#c8102e] shadow-md"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setDrawerRoom(r)}
                                        className="font-mono text-base font-extrabold text-[#111114] hover:text-[#c8102e] hover:underline"
                                      >
                                        {r.room_code}
                                      </button>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleRoomSelect(r.id)}
                                        className="h-4 w-4 rounded accent-[#c8102e] cursor-pointer"
                                      />
                                    </div>

                                    {viewMode === "CARDS" ? (
                                      <div onClick={() => setDrawerRoom(r)} className="mt-2.5 space-y-2">
                                        <div className="flex items-center justify-between text-sm font-bold">
                                          <span className="tabular-nums">
                                            {r.current_count}/{r.capacity} chỗ
                                          </span>
                                          <span
                                            className={cn(
                                              "rounded-lg px-2 py-0.5 text-xs font-extrabold",
                                              r.gender_type === "MALE"
                                                ? "bg-sky-100 text-sky-800"
                                                : r.gender_type === "FEMALE"
                                                ? "bg-rose-100 text-rose-800"
                                                : "bg-white/90 text-stone-700"
                                            )}
                                          >
                                            {r.gender_type === "MALE" ? "Nam" : r.gender_type === "FEMALE" ? "Nữ" : "Trống"}
                                          </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/80">
                                          <div
                                            className={cn(
                                              "h-full rounded-full",
                                              isLocked
                                                ? "bg-stone-400"
                                                : isOver
                                                ? "bg-amber-500"
                                                : isFull
                                                ? "bg-[#c8102e]"
                                                : "bg-emerald-600"
                                            )}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div onClick={() => setDrawerRoom(r)} className="mt-1.5 flex items-center justify-between text-xs font-extrabold">
                                        <span>{r.current_count}/{r.capacity}</span>
                                        <span>{r.gender_type === "MALE" ? "Nam" : r.gender_type === "FEMALE" ? "Nữ" : "—"}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FLOATING OBSIDIAN ACTION DOCK ── */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-6xl animate-fade-up rounded-3xl border border-white/15 bg-[#111114]/95 p-4 text-white shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-xl bg-[#c8102e] px-3.5 py-1.5 text-sm font-extrabold text-white">
                  Đã chọn {selectedIds.size} phòng
                </span>

                <button
                  type="button"
                  onClick={() => runBulkPatch({ updates: { is_locked: true } })}
                  className="flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-sm font-bold text-white hover:bg-white/20"
                >
                  <Lock className="h-4 w-4" /> Khóa
                </button>
                <button
                  type="button"
                  onClick={() => runBulkPatch({ updates: { is_locked: false } })}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  <Unlock className="h-4 w-4" /> Mở khóa
                </button>

                <select
                  onChange={e => {
                    if (!e.target.value) return;
                    const val = e.target.value === "AUTO" ? null : e.target.value;
                    runBulkPatch({ updates: { fixed_gender: val } });
                    e.target.value = "";
                  }}
                  className="min-h-[38px] rounded-xl border border-white/20 bg-white px-3 text-sm font-semibold text-[#111114]"
                >
                  <option value="">-- Cố định giới tính --</option>
                  <option value="AUTO">Tự động</option>
                  <option value="MALE">Nam cố định</option>
                  <option value="FEMALE">Nữ cố định</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Giá mới"
                    value={bulkPrice}
                    onChange={e => setBulkPrice(e.target.value)}
                    className="min-h-[38px] w-28 rounded-xl bg-white px-3 text-sm font-semibold text-[#111114]"
                  />
                  <button
                    type="button"
                    onClick={() => bulkPrice && runBulkPatch({ updates: { price: Number(bulkPrice) } })}
                    className="min-h-[38px] rounded-xl bg-[#c8102e] px-3 text-sm font-bold text-white hover:bg-[#a50d26]"
                  >
                    Đổi giá
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Chỗ"
                    value={bulkCapacity}
                    onChange={e => setBulkCapacity(e.target.value)}
                    className="min-h-[38px] w-20 rounded-xl bg-white px-3 text-sm font-semibold text-[#111114]"
                  />
                  <button
                    type="button"
                    onClick={() => bulkCapacity !== "" && runBulkPatch({ updates: { capacity: Number(bulkCapacity) } })}
                    className="min-h-[38px] rounded-xl bg-[#c8102e] px-3 text-sm font-bold text-white hover:bg-[#a50d26]"
                  >
                    Đổi chỗ
                  </button>
                </div>

                {amenities.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkAmenityId}
                      onChange={e => setBulkAmenityId(e.target.value)}
                      className="min-h-[38px] rounded-xl bg-white px-2.5 text-sm font-semibold text-[#111114]"
                    >
                      <option value="">-- Tiện ích --</option>
                      {amenities.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => bulkAmenityId && runBulkPatch({ add_amenity_ids: [bulkAmenityId] })}
                      className="min-h-[38px] rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"
                    >
                      +Gán
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkAmenityId && runBulkPatch({ remove_amenity_ids: [bulkAmenityId] })}
                      className="min-h-[38px] rounded-xl bg-red-600 px-3 text-sm font-bold text-white"
                    >
                      -Gỡ
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Master Data Tab */
        <div className="space-y-5">
          {masterError && (
            <div className="animate-shake rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-[15px] font-bold text-red-700">
              {masterError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Buildings */}
            <div className="bento-card rounded-3xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-[#111114]">Danh mục Tòa nhà / Dãy</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Bước 1: Tạo tòa nhà → Bước 2: Bấm &quot;+ Tạo phòng&quot; ngay trên tòa nhà đó.
                </p>
              </div>
              <form onSubmit={handleCreateBuilding} className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-extrabold uppercase text-stone-600">
                    Mã tòa <span className="text-[#c8102e]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bCode}
                    onChange={e => setBCode(e.target.value)}
                    placeholder="VD: D10"
                    className="min-h-[46px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-3.5 text-base font-mono uppercase focus:border-[#c8102e] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="mb-1 block text-xs font-extrabold uppercase text-stone-600">
                    Tên tòa nhà <span className="text-[#c8102e]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bName}
                    onChange={e => setBName(e.target.value)}
                    placeholder="VD: Nhà D10"
                    className="min-h-[46px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-3.5 text-base focus:border-[#c8102e] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-extrabold uppercase text-stone-600">Thứ tự</label>
                  <input
                    type="number"
                    min={1}
                    value={bSort}
                    onChange={e => setBSort(Number(e.target.value))}
                    className="min-h-[46px] w-full rounded-2xl border border-black/15 bg-[#f6f5f2] px-3 text-base focus:border-[#c8102e] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[#c8102e] px-4 text-sm font-extrabold text-white hover:bg-[#a50d26] transition"
                  >
                    <Plus className="h-4 w-4" /> Thêm tòa
                  </button>
                </div>
              </form>

              <ul className="divide-y divide-black/8">
                {buildings.map(b => {
                  const countInBuilding = rooms.filter(r => r.building_id === b.id).length;
                  const isEditing = editingBuildingId === b.id;
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-[15px]">
                      {isEditing ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <span className="font-mono font-extrabold text-[#111114]">{b.code}</span>
                          <input
                            type="text"
                            value={editBName}
                            onChange={e => setEditBName(e.target.value)}
                            className="rounded-xl border border-black/15 px-3 py-1.5 text-[15px]"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editBSort}
                            onChange={e => setEditBSort(Number(e.target.value))}
                            className="w-20 rounded-xl border border-black/15 px-3 py-1.5 text-[15px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveBuildingEdit(b.id)}
                            className="rounded-xl bg-emerald-600 p-2 text-white"
                            title="Lưu"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBuildingId(null)}
                            className="rounded-xl bg-stone-200 p-2 text-stone-700"
                            title="Hủy"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="rounded-lg bg-[#111114] px-2.5 py-0.5 font-mono text-sm font-extrabold text-white">
                            {b.code}
                          </span>{" "}
                          <span className="ml-1 font-extrabold text-[#111114]">{b.name}</span>
                          <p className="mt-1 text-sm font-medium text-stone-500">
                            {countInBuilding} phòng · Thứ tự hiển thị #{b.sort_order}
                          </p>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setModalBuildingId(b.id);
                              setShowBulkModal(true);
                            }}
                            className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-extrabold text-[#c8102e] hover:bg-red-100"
                          >
                            <Plus className="h-4 w-4" /> Tạo phòng
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBuildingId(b.id);
                              setEditBName(b.name);
                              setEditBSort(b.sort_order);
                            }}
                            className="rounded-xl p-2 text-stone-600 hover:bg-stone-100"
                            title="Sửa tên / thứ tự"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBuildingLock(b)}
                            className={cn(
                              "rounded-xl px-3 py-2 text-sm font-bold",
                              b.is_locked ? "bg-red-100 text-[#c8102e]" : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {b.is_locked ? "Đang khóa" : "Đang mở"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBuilding(b.id)}
                            className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                            title="Xóa tòa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Amenities */}
            <div className="bento-card rounded-3xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-[#111114]">Danh mục Tiện ích</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Các nhãn tiện ích để gắn cho phòng và giúp sinh viên lọc phòng nhanh chóng.
                </p>
              </div>
              <form onSubmit={handleCreateAmenity} className="flex gap-2.5">
                <input
                  type="text"
                  required
                  value={aName}
                  onChange={e => setAName(e.target.value)}
                  placeholder="Nhập tên tiện ích mới..."
                  className="min-h-[46px] flex-1 rounded-2xl border border-black/15 bg-[#f6f5f2] px-4 text-base focus:border-[#c8102e] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex min-h-[46px] items-center gap-1.5 rounded-2xl bg-[#111114] px-5 text-sm font-extrabold text-white hover:bg-[#c8102e] transition"
                >
                  <Plus className="h-4 w-4" /> Thêm
                </button>
              </form>

              {(() => {
                const existingNames = new Set(amenities.map(a => a.name.toLowerCase()));
                const suggestions = ["Điều hòa", "Nóng lạnh", "Khép kín", "Giường tầng", "Wifi", "Tủ cá nhân"].filter(
                  s => !existingNames.has(s.toLowerCase())
                );
                if (suggestions.length === 0) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-stone-600">Gợi ý nhanh:</span>
                    {suggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => createAmenityByName(s)}
                        className="rounded-full border border-dashed border-red-400 bg-red-50 px-3.5 py-1.5 text-sm font-bold text-[#c8102e] hover:bg-red-100"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="flex flex-wrap gap-2.5 pt-2">
                {amenities.map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f6f5f2] px-4 py-2 text-sm font-bold text-[#111114]"
                  >
                    {a.name}
                    <button
                      type="button"
                      onClick={() => handleDeleteAmenity(a.id)}
                      className="text-stone-400 hover:text-[#c8102e] font-extrabold text-base leading-none"
                      title="Xóa tiện ích"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <BulkRoomGeneratorModal
          buildings={buildings}
          amenities={amenities}
          initialBuildingId={modalBuildingId}
          onClose={() => {
            setShowBulkModal(false);
            setModalBuildingId(undefined);
          }}
          onCreated={loadData}
        />
      )}

      {drawerRoom && (
        <RoomDetailDrawer
          key={drawerRoom.id}
          room={drawerRoom}
          amenities={amenities}
          onClose={() => setDrawerRoom(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
