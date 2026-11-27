"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { Building, DynamicField, Gender, PublicRoom } from "@/lib/types";

interface RegistrationModalProps {
  room: PublicRoom;
  building: Building | undefined;
  dynamicFields: DynamicField[];
  onClose: () => void;
  onRoomStale: (roomId: string, errorCode: string) => void;
  onSuccessRefresh: () => void;
}

const STALE_ERROR_CODES = new Set(["ROOM_FULL","ROOM_LOCKED","BUILDING_LOCKED","GENDER_MISMATCH"]);

export function RegistrationModal({ room, building, dynamicFields, onClose, onRoomStale, onSuccessRefresh }: RegistrationModalProps) {
  const [fullName, setFullName]   = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [gender, setGender]       = useState<Gender>(room.fixed_gender ?? (room.gender_type !== "EMPTY" ? room.gender_type : "MALE"));
  const [dob, setDob]             = useState("");
  const [extraData, setExtraData] = useState<Record<string, unknown>>({});
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [resetSignal, setResetSignal] = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [networkUncertain, setNetworkUncertain] = useState(false);
  const [successData, setSuccessData] = useState<{ registration_id: string; room_code: string } | null>(null);

  const effectiveRoomGender = room.fixed_gender ?? room.gender_type;
  const hasGenderWarning = effectiveRoomGender !== "EMPTY" && effectiveRoomGender !== gender;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || networkUncertain) return;
    setErrorMsg(null);
    if (!turnstileToken) { setErrorMsg("Vui lòng hoàn thành xác thực bảo mật."); return; }
    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);
    try {
      const res  = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ room_id: room.id, student_code: studentCode.trim(), full_name: fullName.trim(), gender, dob, extra_data: extraData, turnstileToken }),
      });
      clearTimeout(timeoutId);
      const json = await res.json() as { success: boolean; error?: string; message?: string; registration_id?: string; room_code?: string };
      if (!json.success) {
        setTurnstileToken(""); setResetSignal(n => n + 1);
        setErrorMsg(json.message ?? "Đăng ký không thành công.");
        if (json.error && STALE_ERROR_CODES.has(json.error)) onRoomStale(room.id, json.error);
        return;
      }
      setSuccessData({ registration_id: json.registration_id ?? "", room_code: json.room_code ?? room.room_code });
      onSuccessRefresh();
    } catch {
      clearTimeout(timeoutId);
      setNetworkUncertain(true);
      setErrorMsg("Mất kết nối hoặc quá thời gian chờ. Không rõ kết quả, vui lòng kiểm tra ở mục Tra cứu trước khi thử lại!");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-medium transition focus:border-red-600 focus:bg-white focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-fade-up max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div>
            {successData ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã giữ chỗ thành công
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                Phiếu đăng ký
              </span>
            )}
            <h2 className="mt-1.5 text-xl font-black text-black">
              {successData ? `Phòng ${successData.room_code}` : `Đăng ký Phòng ${room.room_code}`}
            </h2>
            <p className="text-xs font-medium text-gray-500">
              {building ? `${building.name} · ` : ""}Tầng {room.floor} · Còn {Math.max(0, room.capacity - room.current_count)}/{room.capacity} chỗ
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-black transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {successData ? (
            <div className="text-center space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-black text-black">Đặt chỗ thành công!</p>
                <p className="mt-1 text-sm text-gray-500">Trạng thái: <span className="font-bold text-amber-600">Chờ duyệt</span></p>
              </div>
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left text-sm space-y-1.5 text-gray-700">
                <p><strong>Họ và tên:</strong> {fullName}</p>
                <p><strong>Mã sinh viên:</strong> {studentCode.toUpperCase()}</p>
                <p><strong>Phòng:</strong> {successData.room_code} {building ? `(${building.name})` : ""}</p>
                <p className="pt-1.5 text-xs font-bold text-red-600">📸 Vui lòng chụp màn hình này để lưu lại thông tin.</p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Link href="/tra-cuu" className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-black font-bold text-sm text-white hover:bg-red-600 transition">
                  Tra cứu kết quả
                </Link>
                <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-xl border-2 border-gray-200 font-bold text-sm text-gray-700 hover:bg-gray-50 transition">
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="animate-shake flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">Họ và tên <span className="text-red-600">*</span></label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="VD: Nguyễn Văn A" className={inputClass} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">Mã sinh viên <span className="text-red-600">*</span></label>
                  <input type="text" required value={studentCode} onChange={e => setStudentCode(e.target.value)} placeholder="VD: 22010101" className={inputClass + " uppercase"} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">Ngày sinh <span className="text-red-600">*</span></label>
                  <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">Giới tính <span className="text-red-600">*</span></label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["MALE","FEMALE"] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className={`min-h-[44px] rounded-xl border-2 font-black text-sm transition ${gender === g
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400"}`}>
                      {g === "MALE" ? "Nam" : "Nữ"}
                    </button>
                  ))}
                </div>
                {hasGenderWarning && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Cảnh báo: Phòng này dành cho {effectiveRoomGender === "MALE" ? "Nam" : "Nữ"}!
                  </p>
                )}
              </div>

              {dynamicFields.map(field => (
                <div key={field.id}>
                  {field.type === "checkbox" ? (
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
                      <input type="checkbox" required={field.required} checked={extraData[field.id] === true}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 accent-red-600" />
                      {field.label} {field.required && <span className="text-red-600">*</span>}
                    </label>
                  ) : field.type === "select" ? (
                    <>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
                        {field.label} {field.required && <span className="text-red-600">*</span>}
                      </label>
                      <select required={field.required} value={String(extraData[field.id] ?? "")}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.value }))}
                        className={inputClass}>
                        <option value="">-- Chọn --</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
                        {field.label} {field.required && <span className="text-red-600">*</span>}
                      </label>
                      <input type={field.type === "number" ? "number" : "text"} required={field.required}
                        placeholder={field.placeholder ?? ""}
                        value={String(extraData[field.id] ?? "")}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.value }))}
                        className={inputClass} />
                    </>
                  )}
                </div>
              ))}

              <TurnstileWidget onVerify={t => setTurnstileToken(t)} onExpire={() => setTurnstileToken("")} resetSignal={resetSignal} />

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={onClose}
                  className="min-h-[44px] flex-1 rounded-xl border-2 border-gray-200 font-black text-sm text-gray-700 hover:bg-gray-50 transition">
                  Hủy
                </button>
                <button type="submit" disabled={submitting || networkUncertain || hasGenderWarning}
                  className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-xl bg-red-600 font-black text-sm text-white shadow-md shadow-red-500/25 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {networkUncertain ? "Kiểm tra ở Tra cứu" : submitting ? "Đang gửi..." : "Xác nhận đăng ký"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
