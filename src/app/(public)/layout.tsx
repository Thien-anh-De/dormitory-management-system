"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Search, BedDouble, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f5f2] text-[#111114]">
      {/* Top institutional strip */}
      <div className="brand-gradient px-4 py-2 text-center text-xs sm:text-[13px] font-bold tracking-wider text-white uppercase">
        Trường Đại học Hà Nội (HANU) · Cổng Đăng Ký Ký Túc Xá Trực Tuyến
      </div>

      {/* Glassmorphic sticky navigation */}
      <header className="sticky top-0 z-30 glass-bar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c8102e] text-white shadow-lg shadow-red-600/25 transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold tracking-tight text-[#111114] leading-tight">
                KTX <span className="brand-text">HANU</span>
              </p>
              <p className="text-xs sm:text-[13px] font-medium text-stone-500 leading-tight">
                Hệ thống Nội trú Sinh viên
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm sm:text-[15px] font-bold transition-all",
                pathname === "/"
                  ? "bg-[#111114] text-white shadow-md shadow-black/15"
                  : "text-stone-600 hover:bg-stone-200/70 hover:text-[#111114]"
              )}
            >
              <BedDouble className="h-4 w-4" />
              <span>Chọn phòng ở</span>
            </Link>
            <Link
              href="/tra-cuu"
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm sm:text-[15px] font-bold transition-all",
                pathname === "/tra-cuu"
                  ? "bg-[#c8102e] text-white shadow-md shadow-red-600/25"
                  : "text-stone-600 hover:bg-stone-200/70 hover:text-[#111114]"
              )}
            >
              <Search className="h-4 w-4" />
              <span>Tra cứu hồ sơ</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-black/8 bg-white/80 py-6 text-sm text-stone-600">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <p className="font-medium">
            © 2026 Ban Quản lý Ký túc xá — Trường Đại học Hà Nội (HANU)
          </p>
          <div className="flex items-center gap-5">
            <span>Hỗ trợ: <strong className="text-[#111114]">ktx@hanu.edu.vn</strong></span>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 font-semibold text-stone-500 hover:text-[#c8102e] transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Cổng quản trị
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
