"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
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

const STALE_ERROR_CODES = new Set([
  "ROOM_FULL",
  "ROOM_LOCKED",
  "BUILDING_LOCKED",
  "GENDER_MISMATCH",
]);

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
  const [successData, setSuccessData] = useState<{
    registration_id: string;
    room_code: string;
  } | null>(null);

  const effectiveRoomGender = room.fixed_gender ?? room.gender_type;
  const hasGenderWarning =
    effectiveRoomGender !== "EMPTY" && effectiveRoomGender !== gender;

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
        setResetSignal((n) => n + 1);
        setErrorMsg(json.message ?? "Đăng ký không thành công.");

        if (json.error && STALE_ERROR_CODES.has(json.error)) {
          onRoomStale(room.id, json.error);
        }
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-modal-in max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white sm:px-6">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
              <Sparkles className="h-3 w-3" />
              {successData ? "Hoàn tất giữ chỗ" : "Phiếu đăng ký"}
            </span>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">
              {successData
                ? "Đăng ký giữ chỗ thành công!"
                : `Phòng ${room.room_code}`}
            </h2>
            <p className="text-xs text-indigo-100">
              {building ? `${building.name} (${building.code}) • ` : ""}
              Tầng {room.floor} • Còn {Math.max(0, room.capacity - room.current_count)}/
              {room.capacity} chỗ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-1.5 text-indigo-100 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {successData ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <p className="text-lg font-extrabold text-slate-900">
                Bạn đã giữ chỗ tại phòng {successData.room_code}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Trạng thái hiện tại:{" "}
                <strong className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800">
                  Chờ duyệt
                </strong>
              </p>

              <div className="mt-4 space-y-1.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-left text-xs text-slate-700">
                <p>
                  <strong>Họ và tên:</strong> {fullName}
                </p>
                <p>
                  <strong>Mã sinh viên:</strong> {studentCode.toUpperCase()}
                </p>
                <p>
                  <strong>Phòng:</strong> {successData.room_code}{" "}
                  {building ? `(${building.name})` : ""}
                </p>
                <p className="pt-1.5 font-semibold text-indigo-700">
                  💡 Vui lòng chụp ảnh màn hình này để lưu lại thông tin đối chiếu.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/tra-cuu"
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700"
                >
                  Sang trang Tra cứu
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {errorMsg && (
                <div className="animate-shake flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Mã sinh viên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="VD: 22010101"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm uppercase transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Ngày sinh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Giới tính <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["MALE", "FEMALE"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        gender === g
                          ? g === "MALE"
                            ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                            : "border-pink-600 bg-pink-50 text-pink-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {g === "MALE" ? "Nam" : "Nữ"}
                    </button>
                  ))}
                </div>
                {hasGenderWarning && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Cảnh báo: Phòng này đang dành cho{" "}
                    {effectiveRoomGender === "MALE" ? "Nam" : "Nữ"}. Bạn sẽ không thể
                    đăng ký nếu khác giới tính phòng!
                  </p>
                )}
              </div>

              {dynamicFields.map((field) => (
                <div key={field.id}>
                  {field.type === "checkbox" ? (
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        required={field.required}
                        checked={extraData[field.id] === true}
                        onChange={(e) =>
                          setExtraData((prev) => ({
                            ...prev,
                            [field.id]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <span>
                        {field.label}{" "}
                        {field.required && <span className="text-red-500">*</span>}
                      </span>
                    </label>
                  ) : field.type === "select" ? (
                    <>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        {field.label}{" "}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        required={field.required}
                        value={String(extraData[field.id] ?? "")}
                        onChange={(e) =>
                          setExtraData((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                      >
                        <option value="">-- Chọn --</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        {field.label}{" "}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        required={field.required}
                        placeholder={field.placeholder ?? ""}
                        value={String(extraData[field.id] ?? "")}
                        onChange={(e) =>
                          setExtraData((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </>
                  )}
                </div>
              ))}

              <TurnstileWidget
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken("")}
                resetSignal={resetSignal}
              />

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || networkUncertain || hasGenderWarning}
                  className="flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {networkUncertain
                    ? "Vui lòng kiểm tra Tra cứu"
                    : submitting
                    ? "Đang gửi..."
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
