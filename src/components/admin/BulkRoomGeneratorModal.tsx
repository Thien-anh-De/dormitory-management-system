"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { Amenity, Building, Gender } from "@/lib/types";

interface BulkRoomGeneratorModalProps {
  buildings: Building[];
  amenities: Amenity[];
  onClose: () => void;
  onCreated: () => void;
}

export function BulkRoomGeneratorModal({
  buildings,
  amenities,
  onClose,
  onCreated,
}: BulkRoomGeneratorModalProps) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [pattern, setPattern] = useState("{floor}{num}{building}");
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(5);
  const [roomsPerFloor, setRoomsPerFloor] = useState(10);
  const [capacity, setCapacity] = useState(6);
  const [price, setPrice] = useState(650000);
  const [fixedGender, setFixedGender] = useState<Gender | "AUTO">("AUTO");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedBuilding = buildings.find((b) => b.id === buildingId);

  const previewRooms = useMemo(() => {
    if (!selectedBuilding) return [];
    const list: { floor: number; room_code: string }[] = [];
    const sFloor = Math.max(0, Math.min(startFloor, endFloor));
    const eFloor = Math.max(startFloor, endFloor);
    const countPerFloor = Math.max(1, Math.min(50, roomsPerFloor));

    for (let f = sFloor; f <= eFloor; f++) {
      for (let i = 1; i <= countPerFloor; i++) {
        const numStr = String(i).padStart(2, "0");
        const code = pattern
          .replaceAll("{floor}", String(f))
          .replaceAll("{num}", numStr)
          .replaceAll("{building}", selectedBuilding.code);
        list.push({ floor: f, room_code: code });
      }
    }
    return list;
  }, [selectedBuilding, pattern, startFloor, endFloor, roomsPerFloor]);

  function toggleAmenity(id: string) {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!selectedBuilding || previewRooms.length === 0) return;
    if (previewRooms.length > 500) {
      setErrorMsg("Tối đa tạo 500 phòng mỗi lần.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        rooms: previewRooms.map((r) => ({
          building_id: selectedBuilding.id,
          floor: r.floor,
          room_code: r.room_code,
          capacity,
          price,
          fixed_gender: fixedGender === "AUTO" ? null : fixedGender,
        })),
        amenity_ids: selectedAmenities,
      };

      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Không thể tạo phòng hàng loạt.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Trình tạo phòng hàng loạt (Bulk Generator)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tòa nhà
            </label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mẫu mã phòng
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm font-mono"
            />
            <p className="mt-0.5 text-[11px] text-slate-500">
              Biến: {"{floor}"}, {"{num}"} (01..), {"{building}"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Từ tầng
            </label>
            <input
              type="number"
              min={0}
              value={startFloor}
              onChange={(e) => setStartFloor(Number(e.target.value))}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Đến tầng
            </label>
            <input
              type="number"
              min={0}
              value={endFloor}
              onChange={(e) => setEndFloor(Number(e.target.value))}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Số phòng mỗi tầng
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={roomsPerFloor}
              onChange={(e) => setRoomsPerFloor(Number(e.target.value))}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Sức chứa mặc định (0 = Bảo trì)
            </label>
            <input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Giá phòng / tháng (VNĐ)
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Giới tính phòng
            </label>
            <select
              value={fixedGender}
              onChange={(e) => setFixedGender(e.target.value as Gender | "AUTO")}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="AUTO">Tự động theo người vào trước</option>
              <option value="MALE">Nam cố định</option>
              <option value="FEMALE">Nữ cố định</option>
            </select>
          </div>
        </div>

        {amenities.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Tiện ích mặc định
            </label>
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a) => {
                const active = selectedAmenities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAmenity(a.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold text-slate-700">
            Xem trước: Sẽ tạo {previewRooms.length} phòng
          </p>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {previewRooms.slice(0, 60).map((r) => (
              <span
                key={r.room_code}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono text-slate-700"
              >
                {r.room_code}
              </span>
            ))}
            {previewRooms.length > 60 && (
              <span className="text-xs text-slate-500">
                ... và {previewRooms.length - 60} phòng nữa
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={submitting || previewRooms.length === 0}
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo {previewRooms.length} phòng
          </button>
        </div>
      </div>
    </div>
  );
}
