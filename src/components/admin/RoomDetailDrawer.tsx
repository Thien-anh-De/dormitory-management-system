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

export function RoomDetailDrawer({
  room,
  amenities,
  onClose,
  onUpdated,
}: RoomDetailDrawerProps) {
  const [capacity, setCapacity] = useState(room.capacity);
  const [price, setPrice] = useState(room.price);
  const [isLocked, setIsLocked] = useState(room.is_locked);
  const [fixedGender, setFixedGender] = useState<Gender | "AUTO">(
    room.fixed_gender ?? "AUTO"
  );
  const [note, setNote] = useState(room.note ?? "");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    room.amenity_ids
  );

  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoadingStudents(true);
    fetch(`/api/admin/rooms/${room.id}`)
      .then((r) => r.json())
      .then((j) => setStudents(j.students ?? []))
      .finally(() => setLoadingStudents(false));
  }, [room.id]);

  function toggleAmenity(id: string) {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Phòng {room.room_code}
            </h2>
            <p className="text-xs text-slate-500">
              Tầng {room.floor} • Sĩ số hiện tại: {room.current_count}/{room.capacity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Sức chứa (0 = Bảo trì)
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
                Giá / tháng (VNĐ)
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Chế độ giới tính
            </label>
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

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium">
            <span>Khóa đăng ký phòng này</span>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600"
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Ghi chú tình trạng thiết bị / phòng
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            />
          </div>

          {amenities.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tiện ích phòng
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

          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
              <Users className="h-4 w-4" />
              Sinh viên trong phòng ({students.length})
            </h3>
            {loadingStudents ? (
              <p className="text-xs text-slate-500">Đang tải...</p>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có sinh viên nào.</p>
            ) : (
              <ul className="space-y-1.5">
                {students.map((st) => (
                  <li
                    key={st.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{st.full_name}</p>
                      <p className="text-slate-500">
                        {st.student_code} • {st.gender === "MALE" ? "Nam" : "Nữ"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        st.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
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

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Xóa phòng
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
