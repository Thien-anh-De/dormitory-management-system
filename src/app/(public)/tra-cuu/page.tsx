"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Search,
  XCircle,
} from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { LookupRegistration } from "@/lib/types";

const STATUS_BADGES = {
  PENDING: {
    label: "Chờ duyệt",
    icon: Clock,
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "Đã duyệt chính thức",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  REJECTED: {
    label: "Bị từ chối",
    icon: XCircle,
    className: "bg-red-50 text-red-800 border-red-200",
  },
  CHECKED_OUT: {
    label: "Đã thanh lý / Trả phòng",
    icon: LogOut,
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
} as const;

export default function LookupPage() {
  const [studentCode, setStudentCode] = useState("");
  const [dob, setDob] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<LookupRegistration | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSearched(false);

    if (!turnstileToken) {
      setErrorMsg("Vui lòng hoàn thành xác thực Cloudflare Turnstile.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: studentCode.trim(),
          dob,
          turnstileToken,
        }),
      });

      const json = (await res.json()) as {
        found?: boolean;
        message?: string;
        registration?: LookupRegistration;
      };

      setTurnstileToken("");
      setResetSignal((n) => n + 1);

      if (!res.ok) {
        setErrorMsg(json.message ?? "Không thể tra cứu lúc này.");
        return;
      }

      setSearched(true);
      setResult(json.found && json.registration ? json.registration : null);
    } catch {
      setErrorMsg("Mất kết nối mạng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const badge = result ? STATUS_BADGES[result.status] : null;
  const BadgeIcon = badge?.icon;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">
          Tra cứu Kết quả Đăng ký KTX
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Nhập chính xác Mã sinh viên và Ngày sinh đã dùng khi đăng ký.
        </p>

        <form onSubmit={handleLookup} className="mt-4 space-y-3.5">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mã sinh viên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="VD: 22010101"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Ngày sinh <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <TurnstileWidget
            onVerify={(t) => setTurnstileToken(t)}
            onExpire={() => setTurnstileToken("")}
            resetSignal={resetSignal}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Đang tra cứu..." : "Tra cứu kết quả"}
          </button>
        </form>
      </div>

      {searched && !result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Không tìm thấy đơn đăng ký nào khớp với Mã sinh viên và Ngày sinh vừa nhập.
        </div>
      )}

      {result && badge && BadgeIcon && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs text-slate-500">{result.wave_name}</p>
              <h2 className="text-lg font-bold text-slate-900">{result.full_name}</h2>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.className}`}
            >
              <BadgeIcon className="h-4 w-4" />
              {badge.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Mã sinh viên</p>
              <p className="font-semibold text-slate-900">{result.student_code}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Giới tính</p>
              <p className="font-semibold text-slate-900">
                {result.gender === "MALE" ? "Nam" : "Nữ"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tòa nhà</p>
              <p className="font-semibold text-slate-900">
                {result.building_name} ({result.building_code})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Phòng</p>
              <p className="font-bold text-blue-700">
                {result.room_code} (Tầng {result.floor})
              </p>
            </div>
          </div>

          {result.status === "REJECTED" && result.reject_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              <strong>Lý do từ chối:</strong> {result.reject_reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
