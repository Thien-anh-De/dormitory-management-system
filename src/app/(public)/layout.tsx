"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9f9]">
      {/* Top banner strip */}
      <div className="brand-gradient py-1 text-center text-[11px] font-semibold tracking-widest text-white/80 uppercase">
        Trường Đại học Hà Nội — HANU
      </div>

      <header className="sticky top-0 z-30 bg-white border-b border-black/8 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-500/30 transition-transform group-hover:scale-105">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-black tracking-tight text-black">
                KTX <span className="brand-text">HANU</span>
              </p>
              <p className="text-[11px] font-medium text-gray-500 leading-tight">
                Đăng ký nội trú trực tuyến
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                pathname === "/"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/25"
                  : "text-gray-600 hover:bg-gray-100 hover:text-black"
              )}
            >
              Đăng ký phòng
            </Link>
            <Link
              href="/tra-cuu"
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                pathname === "/tra-cuu"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/25"
                  : "text-gray-600 hover:bg-gray-100 hover:text-black"
              )}
            >
              <Search className="h-3.5 w-3.5" />
              Tra cứu
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-black/8 bg-white py-4 text-center text-xs text-gray-500">
        © 2026 Ký túc xá Trường Đại học Hà Nội (HANU) · Hỗ trợ: ktx@hanu.edu.vn
      </footer>
    </div>
  );
}
