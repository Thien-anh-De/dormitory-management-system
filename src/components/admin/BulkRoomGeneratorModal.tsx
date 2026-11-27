"use client";

import { useMemo, useState } from "react";
import { BedDouble, Loader2, Plus, Sparkles, X } from "lucide-react";
import type { Amenity, Building, Gender } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BulkRoomGeneratorModalProps {
  buildings: Building[];
  amenities: Amenity[];
  initialBuildingId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const PRESET_PATTERNS = [
  {
    id: "KTX_STD",
    label: "Kiểu 1 (Phổ biến)",
    pattern: "{floor}{num}{building}",
    example: (bCode: string) => `201${bCode}`,
    desc: "Tầng + Số phòng + Tòa",
  },
  {
    id: "DASH",
    label: "Kiểu 2 (Có gạch nối)",
    pattern: "{building}-{floor}{num}",
    example: (bCode: string) => `${bCode}-201`,
    desc: "Tòa - Tầng + Số phòng",
  },
  {
    id: "DOT",
    label: "Kiểu 3 (Chữ P)",
    pattern: "{building}.P{floor}{num}",
    example: (bCode: string) => `${bCode}.P201`,
    desc: "Tòa.P + Tầng + Số phòng",
  },
] as const;

export function BulkRoomGeneratorModal({
  buildings,
  amenities,
  initialBuildingId,
  onClose,
  onCreated,
}: BulkRoomGeneratorModalProps) {
  const [mode, setMode] = useState<"BULK" | "SINGLE">("BULK");
  const [buildingId, setBuildingId] = useState(
    initialBuildingId || buildings[0]?.id || ""
  );

  // Bulk fields
  const [pattern, setPattern] = useState("{floor}{num}{building}");
  const [showAdvancedPattern, setShowAdvancedPattern] = useState(false);
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(5);
  const [startRoomNum, setStartRoomNum] = useState(1);
  const [endRoomNum, setEndRoomNum] = useState(10);
  const [skipExisting, setSkipExisting] = useState(true);

  // Single room fields
  const [singleCode, setSingleCode] = useState("");
  const [singleFloor, setSingleFloor] = useState(1);
  const [singleNote, setSingleNote] = useState("");

  // Shared fields
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
    const sNum = Math.max(1, Math.min(startRoomNum, endRoomNum));
    const eNum = Math.min(99, Math.max(startRoomNum, endRoomNum));

    for (let f = sFloor; f <= eFloor; f++) {
      for (let i = sNum; i <= eNum; i++) {
        const numStr = String(i).padStart(2, "0");
        const code = pattern
          .replaceAll("{floor}", String(f))
          .replaceAll("{num}", numStr)
          .replaceAll("{building}", selectedBuilding.code);
        list.push({ floor: f, room_code: code });
      }
    }
    return list;
  }, [selectedBuilding, pattern, startFloor, endFloor, startRoomNum, endRoomNum]);

  function toggleAmenity(id: string) {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBuilding) return;
    setErrorMsg(null);

    const roomsToCreate =
      mode === "SINGLE"
        ? [
            {
              building_id: selectedBuilding.id,
              floor: singleFloor,
              room_code: singleCode.trim().toUpperCase(),
              capacity,
              price,
              fixed_gender: fixedGender === "AUTO" ? null : fixedGender,
              note: singleNote.trim(),
            },
          ]
        : previewRooms.map((r) => ({
            building_id: selectedBuilding.id,
            floor: r.floor,
            room_code: r.room_code,
            capacity,
            price,
            fixed_gender: fixedGender === "AUTO" ? null : fixedGender,
            note: "",
          }));

    if (roomsToCreate.length === 0) {
      setErrorMsg("Chưa có phòng nào để tạo.");
      return;
    }
    if (roomsToCreate.length > 500) {
      setErrorMsg("Tối đa tạo 500 phòng mỗi lần.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: roomsToCreate,
          amenity_ids: selectedAmenities,
          skip_existing: mode === "BULK" ? skipExisting : false,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Không thể tạo phòng.");
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
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Thêm Phòng Ký túc xá
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("BULK")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition",
              mode === "BULK"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Tạo nhanh cả tòa / nhiều tầng
          </button>
          <button
            type="button"
            onClick={() => setMode("SINGLE")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition",
              mode === "SINGLE"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Plus className="h-4 w-4" />
            Thêm 1 phòng lẻ
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Select Building */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">
            1. Thuộc Tòa nhà / Dãy nào?
          </label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (Mã: {b.code})
              </option>
            ))}
          </select>
        </div>

        {mode === "BULK" ? (
          <>
            {/* Step 2: Naming Preset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800">
                  2. Chọn kiểu đặt tên mã phòng
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPattern((v) => !v)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {showAdvancedPattern ? "Ẩn tùy chỉnh tay" : "Tự gõ mẫu riêng"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PRESET_PATTERNS.map((p) => {
                  const selected = pattern === p.pattern;
                  const bCode = selectedBuilding?.code ?? "D10";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPattern(p.pattern)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        selected
                          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-xs font-semibold text-slate-600">{p.label}</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                        {p.example(bCode)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              {showAdvancedPattern && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Mẫu tùy chỉnh (dùng {"{floor}"} = tầng, {"{num}"} = số phòng, {"{building}"} = mã tòa)
                  </label>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Floor & Room Range */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                3. Chọn số tầng và số phòng cần tạo
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Từ tầng</span>
                  <input
                    type="number"
                    min={0}
                    value={startFloor}
                    onChange={(e) => setStartFloor(Number(e.target.value))}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Đến tầng</span>
                  <input
                    type="number"
                    min={0}
                    value={endFloor}
                    onChange={(e) => setEndFloor(Number(e.target.value))}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Từ phòng số</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={startRoomNum}
                    onChange={(e) => setStartRoomNum(Number(e.target.value))}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-600">Đến phòng số</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={endRoomNum}
                    onChange={(e) => setEndRoomNum(Number(e.target.value))}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Single Room Form */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Mã phòng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={singleCode}
                onChange={(e) => setSingleCode(e.target.value)}
                placeholder={`VD: 201${selectedBuilding?.code ?? "D10"}`}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tầng <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={singleFloor}
                onChange={(e) => setSingleFloor(Number(e.target.value))}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Ghi chú (tùy chọn)
              </label>
              <input
                type="text"
                value={singleNote}
                onChange={(e) => setSingleNote(e.target.value)}
                placeholder="VD: Phòng đầu dãy"
                className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>
        )}

        {/* Step 4: Capacity, Price, Gender */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">
            {mode === "BULK" ? "4. Thông số mặc định cho các phòng" : "2. Thông số phòng"}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <span className="mb-1 block text-xs text-slate-600">
                Số giường / sức chứa (0 = Kho/Bảo trì)
              </span>
              <input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-slate-600">Giá thuê / tháng (VNĐ)</span>
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
              <span className="mb-1 block text-xs text-slate-600">Giới tính phòng</span>
              <select
                value={fixedGender}
                onChange={(e) => setFixedGender(e.target.value as Gender | "AUTO")}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="AUTO">Tự động theo người vào trước</option>
                <option value="MALE">Cố định phòng Nam</option>
                <option value="FEMALE">Cố định phòng Nữ</option>
              </select>
            </div>
          </div>
        </div>

        {amenities.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Tiện ích có sẵn trong phòng
            </label>
            <div className="flex flex-wrap gap-2">
              {amenities.map((a) => {
                const active = selectedAmenities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAmenity(a.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
          </div>
        )}

        {mode === "BULK" && (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600"
              />
              Tự động bỏ qua nếu mã phòng đã tồn tại (không báo lỗi trùng)
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="mb-2 text-xs font-bold text-slate-800">
                Xem trước: Sẽ tạo {previewRooms.length} phòng
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {previewRooms.slice(0, 60).map((r) => (
                  <span
                    key={r.room_code}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono font-semibold text-slate-800"
                  >
                    {r.room_code}
                  </span>
                ))}
                {previewRooms.length > 60 && (
                  <span className="text-xs text-slate-600">
                    ... và {previewRooms.length - 60} phòng nữa
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || (mode === "BULK" && previewRooms.length === 0)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "SINGLE"
              ? "Thêm phòng này"
              : `Tạo ${previewRooms.length} phòng`}
          </button>
        </div>
      </form>
    </div>
  );
}
