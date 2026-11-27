"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50/80 via-[#f5f4ff] to-violet-50/70">
      <header className="sticky top-0 z-30 border-b border-indigo-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 transition-transform group-hover:scale-105">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Ký Túc Xá <span className="gradient-text">HANU</span>
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                Cổng đăng ký nội trú trực tuyến
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm",
                pathname === "/"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Đăng ký phòng
            </Link>
            <Link
              href="/tra-cuu"
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm",
                pathname === "/tra-cuu"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              )}
            >
              <Search className="h-3.5 w-3.5" />
              Tra cứu kết quả
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-7">
        {children}
      </main>

      <footer className="border-t border-indigo-100/80 bg-white/70 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
        <p className="font-medium text-slate-600">
          Hệ thống Quản lý Ký túc xá Trực tuyến — Trường Đại học Hà Nội (HANU)
        </p>
      </footer>
    </div>
  );
}
