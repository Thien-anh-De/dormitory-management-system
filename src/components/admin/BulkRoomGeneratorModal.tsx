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
  const [buildingId, setBuildingId] = useState(initialBuildingId || buildings[0]?.id || "");

  const [pattern, setPattern] = useState("{floor}{num}{building}");
  const [showAdvancedPattern, setShowAdvancedPattern] = useState(false);
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(5);
  const [startRoomNum, setStartRoomNum] = useState(1);
  const [endRoomNum, setEndRoomNum] = useState(10);
  const [skipExisting, setSkipExisting] = useState(true);

  const [singleCode, setSingleCode] = useState("");
  const [singleFloor, setSingleFloor] = useState(1);
  const [singleNote, setSingleNote] = useState("");

  const [capacity, setCapacity] = useState(6);
  const [price, setPrice] = useState(650000);
  const [fixedGender, setFixedGender] = useState<Gender | "AUTO">("AUTO");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedBuilding = buildings.find(b => b.id === buildingId);

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
    setSelectedAmenities(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
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
        : previewRooms.map(r => ({
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

  const inputClass =
    "min-h-[46px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-3.5 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-up flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="obsidian-mesh flex items-center justify-between px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c8102e]">
              <BedDouble className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Thêm Phòng Ký túc xá</h2>
              <p className="text-sm text-white/70">Khởi tạo nhanh hàng loạt hoặc từng phòng lẻ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/80 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f6f5f2] p-1.5">
            <button
              type="button"
              onClick={() => setMode("BULK")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-extrabold transition",
                mode === "BULK" ? "bg-[#111114] text-white shadow-sm" : "text-stone-600 hover:text-[#111114]"
              )}
            >
              <Sparkles className="h-4 w-4" />
              Tạo nhanh cả tòa / tầng
            </button>
            <button
              type="button"
              onClick={() => setMode("SINGLE")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-extrabold transition",
                mode === "SINGLE" ? "bg-[#111114] text-white shadow-sm" : "text-stone-600 hover:text-[#111114]"
              )}
            >
              <Plus className="h-4 w-4" />
              Thêm 1 phòng lẻ
            </button>
          </div>

          {errorMsg && (
            <div className="animate-shake rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Select Building */}
          <div>
            <label className="mb-1.5 block text-[15px] font-extrabold text-[#111114]">
              1. Thuộc Tòa nhà / Dãy nào?
            </label>
            <select
              value={buildingId}
              onChange={e => setBuildingId(e.target.value)}
              className={inputClass}
            >
              {buildings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} (Mã: {b.code})
                </option>
              ))}
            </select>
          </div>

          {mode === "BULK" ? (
            <>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[15px] font-extrabold text-[#111114]">
                    2. Chọn kiểu đặt tên mã phòng
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedPattern(v => !v)}
                    className="text-sm font-bold text-[#c8102e] hover:underline"
                  >
                    {showAdvancedPattern ? "Ẩn tùy chỉnh tay" : "Tự gõ mẫu riêng"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {PRESET_PATTERNS.map(p => {
                    const selected = pattern === p.pattern;
                    const bCode = selectedBuilding?.code ?? "D10";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPattern(p.pattern)}
                        className={cn(
                          "rounded-2xl border-2 p-3.5 text-left transition",
                          selected
                            ? "border-[#c8102e] bg-red-50"
                            : "border-stone-200 bg-white hover:bg-[#f6f5f2]"
                        )}
                      >
                        <p className="text-xs font-bold text-stone-600">{p.label}</p>
                        <p className="mt-1 font-mono text-lg font-extrabold text-[#111114]">
                          {p.example(bCode)}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {showAdvancedPattern && (
                  <div className="rounded-2xl border border-black/10 bg-[#f6f5f2] p-3.5">
                    <label className="mb-1.5 block text-xs font-bold text-stone-700">
                      Mẫu tùy chỉnh (dùng {"{floor}"} = tầng, {"{num}"} = số phòng, {"{building}"} = mã tòa)
                    </label>
                    <input
                      type="text"
                      value={pattern}
                      onChange={e => setPattern(e.target.value)}
                      className={inputClass + " bg-white font-mono"}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[15px] font-extrabold text-[#111114]">
                  3. Chọn dải tầng và số phòng cần tạo
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="mb-1 block text-xs font-bold text-stone-600">Từ tầng</span>
                    <input type="number" min={0} value={startFloor} onChange={e => setStartFloor(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-stone-600">Đến tầng</span>
                    <input type="number" min={0} value={endFloor} onChange={e => setEndFloor(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-stone-600">Từ phòng số</span>
                    <input type="number" min={1} max={99} value={startRoomNum} onChange={e => setStartRoomNum(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-stone-600">Đến phòng số</span>
                    <input type="number" min={1} max={99} value={endRoomNum} onChange={e => setEndRoomNum(Number(e.target.value))} className={inputClass} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-stone-700">
                  Mã phòng <span className="text-[#c8102e]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleCode}
                  onChange={e => setSingleCode(e.target.value)}
                  placeholder={`VD: 201${selectedBuilding?.code ?? "D10"}`}
                  className={inputClass + " font-mono uppercase"}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-stone-700">
                  Tầng <span className="text-[#c8102e]">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={singleFloor}
                  onChange={e => setSingleFloor(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-stone-700">Ghi chú</label>
                <input
                  type="text"
                  value={singleNote}
                  onChange={e => setSingleNote(e.target.value)}
                  placeholder="VD: Phòng đầu dãy"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Capacity, Price, Gender */}
          <div>
            <label className="mb-1.5 block text-[15px] font-extrabold text-[#111114]">
              {mode === "BULK" ? "4. Thông số mặc định cho các phòng" : "2. Thông số phòng"}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-xs font-bold text-stone-600">Sức chứa (0 = Bảo trì)</span>
                <input type="number" min={0} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <span className="mb-1 block text-xs font-bold text-stone-600">Giá / tháng (VNĐ)</span>
                <input type="number" min={0} step={10000} value={price} onChange={e => setPrice(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <span className="mb-1 block text-xs font-bold text-stone-600">Giới tính phòng</span>
                <select value={fixedGender} onChange={e => setFixedGender(e.target.value as Gender | "AUTO")} className={inputClass}>
                  <option value="AUTO">Tự động theo người đầu</option>
                  <option value="MALE">Cố định phòng Nam</option>
                  <option value="FEMALE">Cố định phòng Nữ</option>
                </select>
              </div>
            </div>
          </div>

          {amenities.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-extrabold text-stone-700">
                Tiện ích có sẵn trong phòng
              </label>
              <div className="flex flex-wrap gap-2">
                {amenities.map(a => {
                  const active = selectedAmenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
                        active
                          ? "border-[#c8102e] bg-[#c8102e] text-white"
                          : "border-black/15 bg-white text-stone-700 hover:bg-[#f6f5f2]"
                      )}
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
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-stone-700">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#c8102e]"
                />
                Tự động bỏ qua nếu mã phòng đã tồn tại (không báo lỗi trùng)
              </label>

              <div className="rounded-2xl border border-black/10 bg-[#f6f5f2] p-4">
                <p className="mb-2.5 text-sm font-extrabold text-[#111114]">
                  Xem trước: Sẽ tạo <span className="text-[#c8102e]">{previewRooms.length}</span> phòng
                </p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {previewRooms.slice(0, 60).map(r => (
                    <span
                      key={r.room_code}
                      className="rounded-lg border border-black/10 bg-white px-2.5 py-1 font-mono text-xs font-extrabold text-[#111114]"
                    >
                      {r.room_code}
                    </span>
                  ))}
                  {previewRooms.length > 60 && (
                    <span className="text-xs font-bold text-stone-500">
                      ... và {previewRooms.length - 60} phòng nữa
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/8 bg-[#f6f5f2] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-2xl border-2 border-stone-300 bg-white px-5 text-[15px] font-bold text-stone-700 hover:bg-stone-100"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting || (mode === "BULK" && previewRooms.length === 0)}
            className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#c8102e] px-6 text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 hover:bg-[#a50d26] disabled:bg-stone-400"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "SINGLE" ? "Thêm phòng này" : `Tạo ${previewRooms.length} phòng`}
          </button>
        </div>
      </form>
    </div>
  );
}
