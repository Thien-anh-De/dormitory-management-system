"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Hash,
  Loader2,
  LogOut,
  MapPin,
  Search,
  User,
  XCircle,
} from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { LookupRegistration } from "@/lib/types";

const STATUS_BADGES = {
  PENDING: {
    label: "Chờ duyệt",
    icon: Clock,
    className: "bg-amber-50 text-amber-800 border-amber-200",
    barColor: "from-amber-400 to-orange-500",
  },
  APPROVED: {
    label: "Đã duyệt chính thức",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    barColor: "from-emerald-500 to-teal-500",
  },
  REJECTED: {
    label: "Bị từ chối",
    icon: XCircle,
    className: "bg-red-50 text-red-800 border-red-200",
    barColor: "from-red-500 to-rose-600",
  },
  CHECKED_OUT: {
    label: "Đã thanh lý / Trả phòng",
    icon: LogOut,
    className: "bg-slate-100 text-slate-700 border-slate-300",
    barColor: "from-slate-400 to-slate-500",
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
      <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Search className="h-3.5 w-3.5" />
              Tra cứu hồ sơ
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-100 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Sơ đồ phòng
            </Link>
          </div>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">
            Tra cứu Kết quả Đăng ký KTX
          </h1>
          <p className="mt-1 text-xs text-indigo-100">
            Nhập chính xác Mã sinh viên và Ngày sinh đã dùng khi nộp đơn.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 p-5 sm:p-6">
          {errorMsg && (
            <div className="animate-shake flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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

          <TurnstileWidget
            onVerify={(t) => setTurnstileToken(t)}
            onExpire={() => setTurnstileToken("")}
            resetSignal={resetSignal}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
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
        <div className="animate-modal-in rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Không tìm thấy hồ sơ đăng ký
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Vui lòng kiểm tra lại Mã sinh viên và Ngày sinh vừa nhập.
          </p>
        </div>
      )}

      {result && badge && BadgeIcon && (
        <div className="animate-modal-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className={`h-1.5 w-full bg-gradient-to-r ${badge.barColor}`} />
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-medium text-indigo-600">
                  {result.wave_name}
                </p>
                <h2 className="mt-0.5 text-lg font-extrabold text-slate-900">
                  {result.full_name}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold ${badge.className}`}
              >
                <BadgeIcon className="h-4 w-4" />
                {badge.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Hash className="h-3 w-3" />
                  Mã sinh viên
                </p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {result.student_code}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <User className="h-3 w-3" />
                  Giới tính
                </p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {result.gender === "MALE" ? "Nam" : "Nữ"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Building2 className="h-3 w-3" />
                  Tòa nhà
                </p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {result.building_name} ({result.building_code})
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50/70 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                  <MapPin className="h-3 w-3" />
                  Phòng đăng ký
                </p>
                <p className="mt-0.5 font-extrabold text-indigo-700">
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
        </div>
      )}
    </div>
  );
}
