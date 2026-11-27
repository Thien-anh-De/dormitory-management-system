"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import type { Amenity, Building, PublicRoom } from "@/lib/types";
import { BulkRoomGeneratorModal } from "@/components/admin/BulkRoomGeneratorModal";
import { RoomDetailDrawer } from "@/components/admin/RoomDetailDrawer";
import { cn } from "@/lib/utils";

export default function AdminRoomsPage() {
  const [tab, setTab] = useState<"GRID" | "MASTER">("GRID");
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
  const [drawerRoom, setDrawerRoom] = useState<PublicRoom | null>(null);

  // Master Data forms
  const [bCode, setBCode] = useState("");
  const [bName, setBName] = useState("");
  const [bSort, setBSort] = useState(0);
  const [aName, setAName] = useState("");

  // Bulk Action inputs
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCapacity, setBulkCapacity] = useState("");
  const [bulkAmenityId, setBulkAmenityId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/rooms");
    if (res.ok) {
      const json = await res.json();
      setBuildings(json.buildings ?? []);
      setAmenities(json.amenities ?? []);
      setRooms(json.rooms ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buildingLockedMap = useMemo(
    () => new Map(buildings.map((b) => [b.id, b.is_locked])),
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
    return rooms.filter((r) => {
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
      .filter((b) => byB.has(b.id))
      .map((b) => ({
        building: b,
        floors: Array.from(byB.get(b.id)!.entries())
          .sort(([f1], [f2]) => f1 - f2)
          .map(([floor, list]) => ({ floor, rooms: list })),
      }));
  }, [buildings, filteredRooms]);

  function toggleRoomSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRoomGroup(list: PublicRoom[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = list.every((r) => next.has(r.id));
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
    const res = await fetch("/api/admin/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: bCode.trim(), name: bName.trim(), sort_order: bSort }),
    });
    if (res.ok) {
      setBCode("");
      setBName("");
      await loadData();
    }
  }

  async function handleDeleteBuilding(id: string) {
    if (!confirm("Xóa tòa nhà sẽ xóa toàn bộ phòng thuộc tòa đó. Tiếp tục?")) return;
    await fetch(`/api/admin/buildings?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleCreateAmenity(e: React.FormEvent) {
    e.preventDefault();
    if (!aName.trim()) return;
    const res = await fetch("/api/admin/amenities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: aName.trim() }),
    });
    if (res.ok) {
      setAName("");
      await loadData();
    }
  }

  async function handleDeleteAmenity(id: string) {
    await fetch(`/api/admin/amenities?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Quản lý Phòng ({rooms.length}) & Danh mục
          </h1>
          <p className="text-xs text-slate-500">
            Tạo phòng hàng loạt, khóa phòng theo tầng/tòa và cấu hình tiện ích.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab("GRID")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold",
                tab === "GRID" ? "bg-blue-600 text-white" : "text-slate-600"
              )}
            >
              Bản đồ phòng
            </button>
            <button
              type="button"
              onClick={() => setTab("MASTER")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold",
                tab === "MASTER" ? "bg-blue-600 text-white" : "text-slate-600"
              )}
            >
              Tòa nhà & Tiện ích
            </button>
          </div>

          <button
            type="button"
            disabled={buildings.length === 0}
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            <Sparkles className="h-4 w-4" />
            Tạo phòng hàng loạt
          </button>
        </div>
      </div>

      {tab === "GRID" ? (
        <>
          {/* Quick Status Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {[
              { key: "ALL", label: "Tổng số phòng", count: roomCounts.total, cls: "border-slate-200 bg-white text-slate-900" },
              { key: "AVAILABLE", label: "Còn trống", count: roomCounts.available, cls: "border-emerald-200 bg-emerald-50 text-emerald-900" },
              { key: "FULL", label: "Đã đầy", count: roomCounts.full, cls: "border-red-200 bg-red-50 text-red-900" },
              { key: "OVER", label: "Vượt sức chứa", count: roomCounts.over, cls: "border-amber-200 bg-amber-50 text-amber-900" },
              { key: "LOCKED", label: "Khóa / Bảo trì", count: roomCounts.locked, cls: "border-slate-300 bg-slate-100 text-slate-800" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                className={cn(
                  "rounded-xl border p-3 text-left transition shadow-sm",
                  item.cls,
                  statusFilter === item.key && "ring-2 ring-blue-600"
                )}
              >
                <p className="text-xs font-semibold opacity-80">{item.label}</p>
                <p className="mt-0.5 text-xl font-bold">{item.count}</p>
              </button>
            ))}
          </div>

          {/* Filter + Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm mã phòng..."
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900"
                />
              </div>

              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
              >
                <option value="ALL">Tất cả tòa nhà</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-500" /> Còn trống
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-red-500" /> Đầy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-400" /> Vượt sức chứa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-slate-500" /> Đang khóa / Bảo trì
              </span>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-md">
              <span className="text-xs font-bold text-blue-900">
                Đã chọn {selectedIds.size} phòng:
              </span>
              <button
                type="button"
                onClick={() => runBulkPatch({ updates: { is_locked: true } })}
                className="flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                <Lock className="h-3.5 w-3.5" /> Khóa
              </button>
              <button
                type="button"
                onClick={() => runBulkPatch({ updates: { is_locked: false } })}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                <Unlock className="h-3.5 w-3.5" /> Mở khóa
              </button>
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  const val = e.target.value === "AUTO" ? null : e.target.value;
                  runBulkPatch({ updates: { fixed_gender: val } });
                  e.target.value = "";
                }}
                className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">-- Cố định giới tính --</option>
                <option value="AUTO">Tự động</option>
                <option value="MALE">Nam cố định</option>
                <option value="FEMALE">Nữ cố định</option>
              </select>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Giá mới"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  className="w-24 rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (bulkPrice) runBulkPatch({ updates: { price: Number(bulkPrice) } });
                  }}
                  className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Đổi giá
                </button>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Sức chứa"
                  value={bulkCapacity}
                  onChange={(e) => setBulkCapacity(e.target.value)}
                  className="w-20 rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (bulkCapacity !== "")
                      runBulkPatch({ updates: { capacity: Number(bulkCapacity) } });
                  }}
                  className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Đổi chỗ
                </button>
              </div>

              {amenities.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={bulkAmenityId}
                    onChange={(e) => setBulkAmenityId(e.target.value)}
                    className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">-- Tiện ích --</option>
                    {amenities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      bulkAmenityId && runBulkPatch({ add_amenity_ids: [bulkAmenityId] })
                    }
                    className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                  >
                    +Gán
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      bulkAmenityId && runBulkPatch({ remove_amenity_ids: [bulkAmenityId] })
                    }
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                  >
                    -Gỡ
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs font-semibold text-slate-600 underline"
              >
                Bỏ chọn
              </button>
            </div>
          )}

          {/* 300 Rooms Grid */}
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Chưa có phòng nào. Hãy bấm &quot;Tạo phòng hàng loạt&quot; để khởi tạo!
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ building, floors }) => {
                const buildingRooms = floors.flatMap((f) => f.rooms);
                return (
                  <div
                    key={building.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {building.name} ({building.code})
                        </h2>
                        <button
                          type="button"
                          onClick={() => selectRoomGroup(buildingRooms)}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Chọn cả tòa
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleBuildingLock(building)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold",
                          building.is_locked
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {building.is_locked ? (
                          <>
                            <Lock className="h-3.5 w-3.5" /> Tòa đang khóa (Bấm mở)
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" /> Đang mở (Bấm khóa tòa)
                          </>
                        )}
                      </button>
                    </div>

                    {floors.map(({ floor, rooms: fRooms }) => {
                      const floorKey = `${building.id}-${floor}`;
                      const collapsed = collapsedFloors.has(floorKey);
                      return (
                        <div key={floorKey} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedFloors((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(floorKey)) next.delete(floorKey);
                                  else next.add(floorKey);
                                  return next;
                                })
                              }
                              className="flex items-center gap-1 text-xs font-bold text-slate-700"
                            >
                              {collapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              Tầng {floor} ({fRooms.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => selectRoomGroup(fRooms)}
                              className="text-[11px] text-blue-600 hover:underline"
                            >
                              Chọn tầng
                            </button>
                          </div>

                          {!collapsed && (
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                              {fRooms.map((r) => {
                                const isLocked = building.is_locked || r.is_locked || r.capacity === 0;
                                const isOver = r.current_count > r.capacity && r.capacity > 0;
                                const isFull = r.capacity > 0 && r.current_count === r.capacity;
                                const checked = selectedIds.has(r.id);
                                const pct = r.capacity > 0 ? Math.min(100, Math.round((r.current_count / r.capacity) * 100)) : 0;

                                return (
                                  <div
                                    key={r.id}
                                    className={cn(
                                      "relative rounded-xl border p-3 text-sm transition cursor-pointer shadow-xs hover:shadow-md",
                                      isLocked
                                        ? "border-slate-300 bg-slate-100 text-slate-800"
                                        : isOver
                                        ? "border-amber-300 bg-amber-50 text-amber-950"
                                        : isFull
                                        ? "border-red-300 bg-red-50 text-red-950"
                                        : "border-emerald-300 bg-emerald-50 text-emerald-950",
                                      checked && "ring-2 ring-blue-600"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setDrawerRoom(r)}
                                        className="text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline"
                                      >
                                        {r.room_code}
                                      </button>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleRoomSelect(r.id)}
                                        className="h-4 w-4 rounded text-blue-600"
                                      />
                                    </div>
                                    <div
                                      onClick={() => setDrawerRoom(r)}
                                      className="mt-2 space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between text-xs font-semibold">
                                        <span className="text-slate-800">
                                          {r.current_count}/{r.capacity} chỗ
                                        </span>
                                        <span
                                          className={cn(
                                            "rounded px-1.5 py-0.5 text-[11px] font-bold",
                                            r.gender_type === "MALE"
                                              ? "bg-blue-100 text-blue-800"
                                              : r.gender_type === "FEMALE"
                                              ? "bg-pink-100 text-pink-800"
                                              : "bg-white/80 text-slate-700"
                                          )}
                                        >
                                          {r.gender_type === "MALE"
                                            ? "Nam"
                                            : r.gender_type === "FEMALE"
                                            ? "Nữ"
                                            : "Trống"}
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                                        <div
                                          className={cn(
                                            "h-full rounded-full",
                                            isLocked
                                              ? "bg-slate-400"
                                              : isOver
                                              ? "bg-amber-500"
                                              : isFull
                                              ? "bg-red-500"
                                              : "bg-emerald-600"
                                          )}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
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
        </>
      ) : (
        /* Master Data Tab */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Buildings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Danh mục Tòa nhà / Dãy</h2>
            <form onSubmit={handleCreateBuilding} className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                placeholder="Mã (VD: D10)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              />
              <input
                type="text"
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Tên (VD: Nhà D10)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  value={bSort}
                  onChange={(e) => setBSort(Number(e.target.value))}
                  placeholder="STT"
                  className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>

            <ul className="divide-y divide-slate-100">
              {buildings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-bold text-slate-900">{b.code}</span> — {b.name}{" "}
                    <span className="text-xs text-slate-400">(STT: {b.sort_order})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleBuildingLock(b)}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-semibold",
                        b.is_locked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      )}
                    >
                      {b.is_locked ? "Đang khóa" : "Đang mở"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBuilding(b.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Amenities */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Danh mục Tiện ích</h2>
            <form onSubmit={handleCreateAmenity} className="flex gap-2">
              <input
                type="text"
                required
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                placeholder="VD: Điều hòa, Nóng lạnh, Khép kín..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Thêm
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {amenities.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {a.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteAmenity(a.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <BulkRoomGeneratorModal
          buildings={buildings}
          amenities={amenities}
          onClose={() => setShowBulkModal(false)}
          onCreated={loadData}
        />
      )}

      {drawerRoom && (
        <RoomDetailDrawer
          room={drawerRoom}
          amenities={amenities}
          onClose={() => setDrawerRoom(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
