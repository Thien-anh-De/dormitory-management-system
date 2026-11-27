"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, GraduationCap, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg("Email hoặc mật khẩu không chính xác.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setErrorMsg("Không thể kết nối máy chủ xác thực.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#111114]">
      {/* Left Architectural Showcase */}
      <div className="relative hidden lg:flex lg:w-[52%] flex-col justify-between overflow-hidden obsidian-mesh p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c8102e] shadow-xl shadow-red-900/50">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight">KTX HANU</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Administration Console
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white/85 hover:bg-white/15 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Cổng Sinh viên
          </Link>
        </div>

        <div className="relative space-y-6 max-w-lg">
          <span className="inline-block rounded-full border border-red-400/30 bg-[#c8102e]/25 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-red-200">
            Trường Đại học Hà Nội
          </span>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15]">
            Trung Tâm Điều Hành
            <span className="block text-[#ff4d67]">Ký Túc Xá Trực Tuyến</span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Quản lý toàn bộ sơ đồ phòng, phê duyệt đơn nội trú, điều phối đợt đăng ký và xuất báo cáo chuẩn mẫu theo thời gian thực.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { title: "300+", desc: "Quản lý phòng ma trận" },
              { title: "Tức thì", desc: "Duyệt & xếp chỗ tự động" },
              { title: "Excel", desc: "Import / Export 1-click" },
            ].map(card => (
              <div key={card.title} className="rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm">
                <p className="font-mono text-xl font-extrabold text-red-400">{card.title}</p>
                <p className="mt-1 text-xs font-medium text-white/70">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/40">
          © 2026 Ban Quản lý Ký túc xá HANU
        </p>
      </div>

      {/* Right Login Surface */}
      <div className="flex flex-1 items-center justify-center bg-[#f6f5f2] p-6 sm:p-10 lg:rounded-l-[32px]">
        <div className="animate-fade-up bento-card w-full max-w-md rounded-3xl p-7 sm:p-9 space-y-7">
          <div>
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c8102e] text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-base font-extrabold text-[#111114]">KTX HANU</span>
              </div>
              <Link href="/" className="text-sm font-bold text-[#c8102e]">
                ← Cổng SV
              </Link>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111114]">
              Đăng nhập quản trị
            </h2>
            <p className="mt-1.5 text-[15px] text-stone-500">
              Dành cho cán bộ Ban Quản lý Ký túc xá được cấp quyền.
            </p>
          </div>

          {errorMsg && (
            <div className="animate-shake rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-bold text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                Email cán bộ
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@hanu.edu.vn"
                className="min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] px-4 py-2.5 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wider text-stone-700">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-[#f6f5f2] pl-4 pr-12 py-2.5 text-base font-medium transition focus:border-[#c8102e] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-[#111114]"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#c8102e] px-5 text-base font-extrabold text-white shadow-lg shadow-red-600/30 transition hover:bg-[#a50d26] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
              {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
