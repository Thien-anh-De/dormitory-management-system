"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2, Users, X } from "lucide-react";
import type { Amenity, Gender, PublicRoom } from "@/lib/types";

interface RoomStudent {
  id: string;
  student_code: string;
  full_name: string;
  gender: Gender;
  status: string;
}

interface RoomDetailDrawerProps {
  room: PublicRoom;
  amenities: Amenity[];
  onClose: () => void;
  onUpdated: () => void;
}

export function RoomDetailDrawer({ room, amenities, onClose, onUpdated }: RoomDetailDrawerProps) {
  const [capacity, setCapacity] = useState(room.capacity);
  const [price, setPrice] = useState(room.price);
  const [isLocked, setIsLocked] = useState(room.is_locked);
  const [fixedGender, setFixedGender] = useState<Gender | "AUTO">(room.fixed_gender ?? "AUTO");
  const [note, setNote] = useState(room.note ?? "");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(room.amenity_ids);

  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/rooms/${room.id}`)
      .then(r => r.json())
      .then(j => {
        if (active) setStudents(j.students ?? []);
      })
      .finally(() => {
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, [room.id]);

  function toggleAmenity(id: string) {
    setSelectedAmenities(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_ids: [room.id],
        updates: {
          capacity,
          price,
          is_locked: isLocked,
          fixed_gender: fixedGender === "AUTO" ? null : fixedGender,
          note,
        },
        set_amenity_ids: selectedAmenities,
      }),
    });

    if (res.ok) {
      onUpdated();
      onClose();
    } else {
      const j = await res.json();
      setErrorMsg(j.error ?? "Không thể lưu thay đổi.");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (students.length > 0) {
      setErrorMsg("Không thể xóa phòng đang có sinh viên lưu trú/chờ duyệt.");
      return;
    }
    if (!confirm(`Xác nhận xóa phòng ${room.room_code}?`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/rooms?id=${room.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onUpdated();
      onClose();
    } else {
      const j = await res.json();
      setErrorMsg(j.error ?? "Không thể xóa phòng.");
    }
    setSaving(false);
  }

  const inputClass =
    "min-h-[46px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-3.5 text-base font-medium focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs">
      <div className="animate-slide-right flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Obsidian Header */}
        <div className="obsidian-mesh flex items-center justify-between px-6 py-5 text-white">
          <div>
            <span className="rounded-full bg-[#c8102e] px-2.5 py-0.5 text-xs font-extrabold uppercase">
              Tầng {room.floor}
            </span>
            <h2 className="mt-1.5 font-mono text-2xl font-extrabold">Phòng {room.room_code}</h2>
            <p className="text-sm text-white/75">
              Sĩ số hiện tại: <strong className="text-white">{room.current_count}/{room.capacity} chỗ</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/75 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="animate-shake rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-stone-600">
                Sức chứa (0 = Bảo trì)
              </label>
              <input type="number" min={0} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className={inputClass} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-stone-600">
                Giá / tháng (VNĐ)
              </label>
              <input type="number" min={0} step={10000} value={price} onChange={e => setPrice(Number(e.target.value))} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-stone-600">
              Chế độ giới tính
            </label>
            <select
              value={fixedGender}
              onChange={e => setFixedGender(e.target.value as Gender | "AUTO")}
              className={inputClass}
            >
              <option value="AUTO">Tự động theo người vào trước</option>
              <option value="MALE">Cố định phòng Nam</option>
              <option value="FEMALE">Cố định phòng Nữ</option>
            </select>
          </div>

          <label className="flex min-h-[50px] cursor-pointer items-center justify-between rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 py-3 text-[15px] font-bold text-[#111114]">
            <span>Khóa đăng ký phòng này</span>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={e => setIsLocked(e.target.checked)}
              className="h-5 w-5 rounded accent-[#c8102e]"
            />
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-stone-600">
              Ghi chú tình trạng thiết bị / phòng
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] p-3.5 text-[15px] focus:border-[#c8102e] focus:bg-white focus:outline-none"
            />
          </div>

          {amenities.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-stone-600">
                Tiện ích phòng
              </label>
              <div className="flex flex-wrap gap-2">
                {amenities.map(a => {
                  const active = selectedAmenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
                        active
                          ? "border-[#c8102e] bg-[#c8102e] text-white"
                          : "border-stone-300 bg-white text-stone-700 hover:bg-[#f6f5f2]"
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-black/10 pt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-stone-700">
              <Users className="h-4 w-4 text-[#c8102e]" />
              Sinh viên trong phòng ({students.length})
            </h3>
            {loadingStudents ? (
              <p className="text-sm text-stone-500">Đang tải danh sách sinh viên...</p>
            ) : students.length === 0 ? (
              <p className="rounded-2xl bg-[#f6f5f2] p-4 text-center text-sm font-medium text-stone-500">
                Chưa có sinh viên nào trong phòng này.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {students.map(st => (
                  <li
                    key={st.id}
                    className="flex items-center justify-between rounded-2xl border border-black/8 bg-[#f6f5f2] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="text-[15px] font-extrabold text-[#111114]">{st.full_name}</p>
                      <p className="font-mono text-xs font-semibold text-stone-500">
                        {st.student_code} · {st.gender === "MALE" ? "Nam" : "Nữ"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                        st.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {st.status === "APPROVED" ? "Đã duyệt" : "Chờ duyệt"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/10 bg-[#f6f5f2] px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-red-600 hover:bg-red-100 transition"
          >
            <Trash2 className="h-4 w-4" />
            Xóa phòng
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#c8102e] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-md shadow-red-600/20 hover:bg-[#a50d26] transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
