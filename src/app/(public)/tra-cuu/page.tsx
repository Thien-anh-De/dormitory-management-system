"use client";

import { useState } from "react";
import {
  AlertCircle, ArrowLeft, Building2, CheckCircle2,
  Clock, Hash, Loader2, LogOut, MapPin, Search, User, XCircle,
} from "lucide-react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { LookupRegistration } from "@/lib/types";

const STATUS_CONFIG = {
  PENDING:     { label: "Chờ duyệt",             icon: Clock,        bar: "bg-amber-500",  badge: "border-amber-200 bg-amber-50 text-amber-800" },
  APPROVED:    { label: "Đã duyệt chính thức",   icon: CheckCircle2, bar: "bg-green-500",  badge: "border-green-200 bg-green-50 text-green-800" },
  REJECTED:    { label: "Bị từ chối",             icon: XCircle,      bar: "bg-red-600",    badge: "border-red-200 bg-red-50 text-red-800" },
  CHECKED_OUT: { label: "Đã thanh lý / Trả phòng", icon: LogOut,     bar: "bg-gray-400",   badge: "border-gray-200 bg-gray-100 text-gray-700" },
} as const;

export default function LookupPage() {
  const [studentCode, setStudentCode] = useState("");
  const [dob, setDob]                 = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [searched, setSearched]       = useState(false);
  const [result, setResult]           = useState<LookupRegistration | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null); setSearched(false);
    if (!turnstileToken) { setErrorMsg("Vui lòng hoàn thành xác thực Cloudflare Turnstile."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/public/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_code: studentCode.trim(), dob, turnstileToken }),
      });
      const json = await res.json() as { found?: boolean; message?: string; registration?: LookupRegistration };
      setTurnstileToken(""); setResetSignal(n => n + 1);
      if (!res.ok) { setErrorMsg(json.message ?? "Không thể tra cứu lúc này."); return; }
      setSearched(true);
      setResult(json.found && json.registration ? json.registration : null);
    } catch {
      setErrorMsg("Mất kết nối mạng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = result ? STATUS_CONFIG[result.status] : null;
  const StatusIcon = cfg?.icon;
  const inputClass = "min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-medium transition focus:border-red-600 focus:bg-white focus:outline-none";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Search card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Top bar */}
        <div className="bg-black px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
              <Search className="h-3.5 w-3.5" /> Tra cứu hồ sơ
            </span>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-white transition">
              <ArrowLeft className="h-3.5 w-3.5" /> Sơ đồ phòng
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Tra cứu kết quả<br />
            <span className="text-red-500">đăng ký KTX</span>
          </h1>
          <p className="mt-1.5 text-xs text-white/50">
            Nhập chính xác Mã sinh viên và Ngày sinh đã dùng khi nộp đơn.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 p-5 sm:p-6">
          {errorMsg && (
            <div className="animate-shake flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
              Mã sinh viên <span className="text-red-600">*</span>
            </label>
            <input type="text" required value={studentCode} onChange={e => setStudentCode(e.target.value)}
              placeholder="VD: 22010101" className={inputClass + " uppercase"} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
              Ngày sinh <span className="text-red-600">*</span>
            </label>
            <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className={inputClass} />
          </div>

          <TurnstileWidget onVerify={t => setTurnstileToken(t)} onExpire={() => setTurnstileToken("")} resetSignal={resetSignal} />

          <button type="submit" disabled={loading}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 font-black text-sm text-white shadow-md shadow-red-500/25 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Đang tra cứu..." : "Tra cứu kết quả"}
          </button>
        </form>
      </div>

      {/* Not found */}
      {searched && !result && (
        <div className="animate-fade-up rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-black text-gray-700">Không tìm thấy hồ sơ đăng ký</p>
          <p className="mt-1 text-xs text-gray-400">Kiểm tra lại Mã sinh viên và Ngày sinh vừa nhập.</p>
        </div>
      )}

      {/* Result card */}
      {result && cfg && StatusIcon && (
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          <div className={`h-1.5 w-full ${cfg.bar}`} />
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs font-bold text-red-600">{result.wave_name}</p>
                <h2 className="text-xl font-black text-black mt-0.5">{result.full_name}</h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-black ${cfg.badge}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {cfg.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Hash,      label: "Mã sinh viên", value: result.student_code },
                { icon: User,      label: "Giới tính",    value: result.gender === "MALE" ? "Nam" : "Nữ" },
                { icon: Building2, label: "Tòa nhà",      value: `${result.building_name} (${result.building_code})` },
              ].map(f => (
                <div key={f.label} className="rounded-xl bg-gray-50 p-3">
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-gray-400">
                    <f.icon className="h-3 w-3" />{f.label}
                  </p>
                  <p className="mt-0.5 font-black text-sm text-black">{f.value}</p>
                </div>
              ))}
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                  <MapPin className="h-3 w-3" />Phòng
                </p>
                <p className="mt-0.5 font-black text-sm text-red-700">
                  {result.room_code} (Tầng {result.floor})
                </p>
              </div>
            </div>

            {result.status === "REJECTED" && result.reject_reason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-800">
                <strong>Lý do từ chối:</strong> {result.reject_reason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
