"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router   = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErrorMsg("Email hoặc mật khẩu không chính xác."); return; }
      router.push("/admin/rooms");
      router.refresh();
    } catch {
      setErrorMsg("Không thể kết nối máy chủ xác thực.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0c0c0c]">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12">
        <div className="absolute inset-0"
          style={{ backgroundImage: "radial-gradient(circle at 30% 60%, rgba(220,38,38,0.25) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(153,27,27,0.15) 0%, transparent 50%)" }} />
        <div className="absolute top-0 left-0 h-full w-full opacity-5"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "24px 24px" }} />
        <div className="relative text-center space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 shadow-2xl shadow-red-900/60">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            KTX HANU
          </h1>
          <p className="text-sm font-medium text-white/40 max-w-xs">
            Hệ thống Quản lý Ký túc xá trực tuyến — Trường Đại học Hà Nội
          </p>
          <div className="pt-4 flex flex-col gap-2 items-center">
            {["300 phòng quản lý", "Đăng ký trực tuyến 24/7", "Duyệt đơn tức thì"].map(f => (
              <span key={f} className="inline-flex items-center gap-2 text-xs font-semibold text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center bg-white p-6 lg:rounded-l-3xl">
        <div className="animate-fade-up w-full max-w-sm space-y-7">
          <div>
            <div className="mb-1 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-black text-black">KTX HANU</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-black">
              Đăng nhập quản trị
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Chỉ dành cho tài khoản Admin được cấp phép.
            </p>
          </div>

          {errorMsg && (
            <div className="animate-shake rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@ktx.hanu.edu.vn"
                className="min-h-[46px] w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium transition focus:border-red-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-700">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-[46px] w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium transition focus:border-red-600 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-black text-sm text-white shadow-lg shadow-red-500/30 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {loading ? "Đang xác thực..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
