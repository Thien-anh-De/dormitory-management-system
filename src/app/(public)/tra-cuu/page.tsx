"use client";

import { useState } from "react";
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
  Ticket,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import type { LookupRegistration } from "@/lib/types";

const STATUS_CONFIG = {
  PENDING: {
    label: "Chờ BQL xét duyệt",
    step: 2,
    icon: Clock,
    bar: "bg-amber-500",
    badge: "border-amber-300 bg-amber-50 text-amber-800",
  },
  APPROVED: {
    label: "Đã duyệt chính thức",
    step: 3,
    icon: CheckCircle2,
    bar: "bg-emerald-600",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  REJECTED: {
    label: "Hồ sơ bị từ chối",
    step: 3,
    icon: XCircle,
    bar: "bg-[#c8102e]",
    badge: "border-red-300 bg-red-50 text-red-800",
  },
  CHECKED_OUT: {
    label: "Đã thanh lý / Trả phòng",
    step: 3,
    icon: LogOut,
    bar: "bg-stone-500",
    badge: "border-stone-300 bg-stone-100 text-stone-700",
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
      setErrorMsg("Vui lòng hoàn thành xác thực bảo mật.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_code: studentCode.trim(), dob, turnstileToken }),
      });
      const json = (await res.json()) as {
        found?: boolean;
        message?: string;
        registration?: LookupRegistration;
      };
      setTurnstileToken("");
      setResetSignal(n => n + 1);
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

  const cfg = result ? STATUS_CONFIG[result.status] : null;
  const StatusIcon = cfg?.icon;
  const inputClass =
    "min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 py-2.5 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none";

  return (
    <div className="mx-auto max-w-5xl grid gap-7 lg:grid-cols-12 lg:items-start">
      {/* Left: Search Form Card */}
      <div className="bento-card overflow-hidden rounded-3xl lg:col-span-5">
        <div className="obsidian-mesh px-6 py-6 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white/90">
              <Search className="h-3.5 w-3.5" /> Tra cứu hồ sơ
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white/70 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" /> Sơ đồ phòng
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            Kiểm Tra Kết Quả
            <span className="block text-[#ff4d67]">Đăng Ký Nội Trú</span>
          </h1>
          <p className="mt-2 text-sm text-white/70 leading-relaxed">
            Nhập chính xác Mã sinh viên và Ngày sinh đã sử dụng khi đăng ký.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-4 p-6">
          {errorMsg && (
            <div className="animate-shake flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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

          <TurnstileWidget
            onVerify={t => setTurnstileToken(t)}
            onExpire={() => setTurnstileToken("")}
            resetSignal={resetSignal}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#c8102e] text-[15px] font-extrabold text-white shadow-lg shadow-red-600/25 transition hover:bg-[#a50d26] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {loading ? "Đang kiểm tra..." : "Tra cứu hồ sơ"}
          </button>
        </form>
      </div>

      {/* Right: Result Boarding Pass or Guide */}
      <div className="lg:col-span-7">
        {result && cfg && StatusIcon ? (
          <div className="animate-fade-up bento-card overflow-hidden rounded-3xl">
            <div className={`h-2 w-full ${cfg.bar}`} />

            <div className="p-6 sm:p-8 space-y-6">
              {/* Top Pass Header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#c8102e]">
                    <Ticket className="h-4 w-4" />
                    {result.wave_name}
                  </span>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#111114]">
                    {result.full_name}
                  </h2>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-extrabold ${cfg.badge}`}
                >
                  <StatusIcon className="h-4 w-4" />
                  {cfg.label}
                </span>
              </div>

              {/* Status Stepper */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f6f5f2] p-3">
                {[
                  { num: 1, title: "Đã nộp hồ sơ", active: true },
                  { num: 2, title: "BQL xem xét", active: cfg.step >= 2 },
                  {
                    num: 3,
                    title: result.status === "REJECTED" ? "Không đạt" : result.status === "CHECKED_OUT" ? "Đã trả phòng" : "Xếp phòng",
                    active: cfg.step >= 3,
                  },
                ].map(st => (
                  <div
                    key={st.num}
                    className={`rounded-xl px-3 py-2 text-center text-xs sm:text-sm font-bold ${
                      st.active ? "bg-white text-[#111114] shadow-xs" : "text-stone-400"
                    }`}
                  >
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#111114] text-xs font-extrabold text-white">
                      {st.num}
                    </span>
                    {st.title}
                  </div>
                ))}
              </div>

              {/* Ticket Cutout Divider */}
              <div className="pass-divider" />

              {/* Info Grid */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f6f5f2] p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-stone-500">
                    <Hash className="h-3.5 w-3.5" /> Mã sinh viên
                  </p>
                  <p className="mt-1 font-mono text-lg font-extrabold text-[#111114]">
                    {result.student_code}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f6f5f2] p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-stone-500">
                    <User className="h-3.5 w-3.5" /> Giới tính
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-[#111114]">
                    {result.gender === "MALE" ? "Nam" : "Nữ"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f6f5f2] p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-stone-500">
                    <Building2 className="h-3.5 w-3.5" /> Tòa nhà
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-[#111114]">
                    {result.building_name} ({result.building_code})
                  </p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#c8102e]">
                    <MapPin className="h-3.5 w-3.5" /> Phòng được xếp
                  </p>
                  <p className="mt-1 font-mono text-xl font-extrabold text-[#c8102e]">
                    {result.room_code}{" "}
                    <span className="font-sans text-sm font-bold text-red-700">
                      (Tầng {result.floor})
                    </span>
                  </p>
                </div>
              </div>

              {result.status === "REJECTED" && result.reject_reason && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[15px] font-semibold text-red-800">
                  <strong className="font-extrabold">Lý do từ chối:</strong> {result.reject_reason}
                </div>
              )}
            </div>
          </div>
        ) : searched ? (
          <div className="animate-fade-up bento-card rounded-3xl border-2 border-dashed border-black/15 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f6f5f2]">
              <Search className="h-8 w-8 text-stone-400" />
            </div>
            <h3 className="text-xl font-extrabold text-[#111114]">Không tìm thấy hồ sơ</h3>
            <p className="mt-2 text-[15px] text-stone-500 max-w-md mx-auto">
              Kiểm tra lại Mã sinh viên (không có dấu cách thừa) và Ngày sinh trùng khớp với hồ sơ đã nộp.
            </p>
          </div>
        ) : (
          <div className="bento-card rounded-3xl p-8 space-y-6">
            <div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#c8102e]">
                Thẻ Nội Trú Điện Tử
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-[#111114]">
                Tra cứu trạng thái xét duyệt nhanh
              </h2>
              <p className="mt-1.5 text-[15px] text-stone-600 leading-relaxed">
                Sau khi gửi biểu mẫu, hồ sơ sẽ hiển thị thẻ xác nhận kèm thông tin phòng, tòa nhà và kết quả duyệt của Ban Quản lý KTX.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { badge: "Chờ duyệt", desc: "Đang giữ chỗ tạm thời cho bạn", color: "bg-amber-50 border-amber-200 text-amber-900" },
                { badge: "Đã duyệt", desc: "Chính thức có tên trong danh sách phòng", color: "bg-emerald-50 border-emerald-200 text-emerald-900" },
                { badge: "Từ chối", desc: "Xem lý do chi tiết và chọn lại nếu còn hạn", color: "bg-red-50 border-red-200 text-red-900" },
              ].map(item => (
                <div key={item.badge} className={`rounded-2xl border p-4 ${item.color}`}>
                  <p className="text-sm font-extrabold">{item.badge}</p>
                  <p className="mt-1 text-sm opacity-85">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
