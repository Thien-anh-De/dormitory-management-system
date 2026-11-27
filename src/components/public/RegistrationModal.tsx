"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Ticket, X } from "lucide-react";
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

const STALE_ERROR_CODES = new Set(["ROOM_FULL", "ROOM_LOCKED", "BUILDING_LOCKED", "GENDER_MISMATCH"]);

export function RegistrationModal({
  room,
  building,
  dynamicFields,
  onClose,
  onRoomStale,
  onSuccessRefresh,
}: RegistrationModalProps) {
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [gender, setGender] = useState<Gender>(
    room.fixed_gender ?? (room.gender_type !== "EMPTY" ? room.gender_type : "MALE")
  );
  const [dob, setDob] = useState("");
  const [extraData, setExtraData] = useState<Record<string, unknown>>({});
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [resetSignal, setResetSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [networkUncertain, setNetworkUncertain] = useState(false);
  const [successData, setSuccessData] = useState<{ registration_id: string; room_code: string } | null>(null);

  const effectiveRoomGender = room.fixed_gender ?? room.gender_type;
  const hasGenderWarning = effectiveRoomGender !== "EMPTY" && effectiveRoomGender !== gender;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || networkUncertain) return;
    setErrorMsg(null);
    if (!turnstileToken) {
      setErrorMsg("Vui lòng hoàn thành xác thực bảo mật Cloudflare Turnstile.");
      return;
    }
    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          room_id: room.id,
          student_code: studentCode.trim(),
          full_name: fullName.trim(),
          gender,
          dob,
          extra_data: extraData,
          turnstileToken,
        }),
      });
      clearTimeout(timeoutId);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        message?: string;
        registration_id?: string;
        room_code?: string;
      };
      if (!json.success) {
        setTurnstileToken("");
        setResetSignal(n => n + 1);
        setErrorMsg(json.message ?? "Đăng ký không thành công.");
        if (json.error && STALE_ERROR_CODES.has(json.error)) onRoomStale(room.id, json.error);
        return;
      }
      setSuccessData({
        registration_id: json.registration_id ?? "",
        room_code: json.room_code ?? room.room_code,
      });
      onSuccessRefresh();
    } catch {
      clearTimeout(timeoutId);
      setNetworkUncertain(true);
      setErrorMsg(
        "Mất kết nối hoặc quá thời gian chờ. Không rõ kết quả, vui lòng kiểm tra ở mục Tra cứu trước khi thử lại!"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "min-h-[48px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 py-2.5 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-fade-up flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Obsidian-Crimson Banner Header */}
        <div className="obsidian-mesh flex items-start justify-between gap-4 px-6 py-5 text-white">
          <div>
            {successData ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 px-3 py-1 text-xs font-extrabold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã giữ chỗ thành công
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c8102e]/30 border border-red-400/35 px-3 py-1 text-xs font-extrabold text-red-200 uppercase tracking-wider">
                <Ticket className="h-3.5 w-3.5" /> Phiếu đăng ký phòng
              </span>
            )}
            <h2 className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold tracking-tight">
              {successData ? `Phòng ${successData.room_code}` : `Phòng ${room.room_code}`}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-white/75">
              {building ? `${building.name} · ` : ""}Tầng {room.floor} · Còn{" "}
              <strong className="text-white">{Math.max(0, room.capacity - room.current_count)}/{room.capacity} chỗ</strong> ·{" "}
              <strong className="text-red-300">{new Intl.NumberFormat("vi-VN").format(room.price)} đ/tháng</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl bg-white/10 p-2 text-white/75 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          {successData ? (
            /* Digital Dormitory Pass Confirmation */
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-11 w-11 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-[#111114]">Đặt chỗ thành công!</h3>
                <p className="mt-1 text-[15px] text-stone-600">
                  Hồ sơ đã được hệ thống ghi nhận ở trạng thái{" "}
                  <span className="font-extrabold text-amber-600">Chờ BQL duyệt</span>
                </p>
              </div>

              <div className="rounded-3xl border border-black/10 bg-[#f6f5f2] p-5 text-left space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-stone-500">Họ và tên</p>
                    <p className="mt-0.5 text-[15px] font-extrabold text-[#111114]">{fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-stone-500">Mã sinh viên</p>
                    <p className="mt-0.5 font-mono text-[15px] font-extrabold text-[#111114]">
                      {studentCode.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-stone-500">Phòng đăng ký</p>
                    <p className="mt-0.5 font-mono text-base font-extrabold text-[#c8102e]">
                      {successData.room_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-stone-500">Tòa nhà</p>
                    <p className="mt-0.5 text-[15px] font-bold text-[#111114]">
                      {building ? `${building.name} (${building.code})` : "—"}
                    </p>
                  </div>
                </div>
                <div className="pass-divider pt-3 text-sm font-bold text-[#c8102e]">
                  Vui lòng chụp màn hình phiếu này để đối chiếu khi nhận phòng.
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tra-cuu"
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-[#111114] text-[15px] font-extrabold text-white hover:bg-[#c8102e] transition"
                >
                  Tra cứu hồ sơ ngay
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] flex-1 rounded-2xl border-2 border-stone-200 text-[15px] font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="animate-shake flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                  Họ và tên <span className="text-[#c8102e]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                    Mã sinh viên <span className="text-[#c8102e]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentCode}
                    onChange={e => setStudentCode(e.target.value)}
                    placeholder="VD: 22010101"
                    className={inputClass + " font-mono uppercase"}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                    Ngày sinh <span className="text-[#c8102e]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                  Giới tính <span className="text-[#c8102e]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["MALE", "FEMALE"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`min-h-[48px] rounded-2xl border-2 text-[15px] font-extrabold transition ${
                        gender === g
                          ? "border-[#111114] bg-[#111114] text-white shadow-sm"
                          : "border-stone-200 bg-[#f6f5f2] text-stone-700 hover:border-stone-400"
                      }`}
                    >
                      {g === "MALE" ? "Nam" : "Nữ"}
                    </button>
                  ))}
                </div>
                {hasGenderWarning && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Lưu ý: Phòng này dành riêng cho sinh viên {effectiveRoomGender === "MALE" ? "Nam" : "Nữ"}!
                  </p>
                )}
              </div>

              {dynamicFields.map(field => (
                <div key={field.id}>
                  {field.type === "checkbox" ? (
                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 py-2.5 text-[15px] font-semibold text-stone-800 hover:bg-stone-200/60 transition">
                      <input
                        type="checkbox"
                        required={field.required}
                        checked={extraData[field.id] === true}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.checked }))}
                        className="h-5 w-5 rounded border-stone-300 accent-[#c8102e]"
                      />
                      <span>
                        {field.label} {field.required && <span className="text-[#c8102e]">*</span>}
                      </span>
                    </label>
                  ) : field.type === "select" ? (
                    <>
                      <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                        {field.label} {field.required && <span className="text-[#c8102e]">*</span>}
                      </label>
                      <select
                        required={field.required}
                        value={String(extraData[field.id] ?? "")}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">-- Chọn --</option>
                        {(field.options ?? []).map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                        {field.label} {field.required && <span className="text-[#c8102e]">*</span>}
                      </label>
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        required={field.required}
                        placeholder={field.placeholder ?? ""}
                        value={String(extraData[field.id] ?? "")}
                        onChange={e => setExtraData(p => ({ ...p, [field.id]: e.target.value }))}
                        className={inputClass}
                      />
                    </>
                  )}
                </div>
              ))}

              <div className="rounded-2xl border border-black/8 bg-[#f6f5f2] p-3">
                <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500">
                  <ShieldCheck className="h-4 w-4 text-[#c8102e]" />
                  Xác thực chống spam
                </div>
                <TurnstileWidget
                  onVerify={t => setTurnstileToken(t)}
                  onExpire={() => setTurnstileToken("")}
                  resetSignal={resetSignal}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[50px] flex-1 rounded-2xl border-2 border-stone-200 text-[15px] font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting || networkUncertain || hasGenderWarning}
                  className="flex min-h-[50px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-[#c8102e] text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 transition hover:bg-[#a50d26] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
                >
                  {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  {networkUncertain
                    ? "Kiểm tra ở Tra cứu"
                    : submitting
                    ? "Đang gửi hồ sơ..."
                    : "Xác nhận đăng ký"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
