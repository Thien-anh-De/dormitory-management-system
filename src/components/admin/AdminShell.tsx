"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Quản lý Phòng", icon: BedDouble },
  { href: "/admin/registrations", label: "Xét duyệt Đơn", icon: ClipboardCheck },
  { href: "/admin/waves", label: "Đợt đăng ký", icon: CalendarRange },
  { href: "/admin/settings", label: "Cài đặt & Form", icon: Settings },
  { href: "/admin/audit-logs", label: "Nhật ký hoạt động", icon: History },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [sessionWarning, setSessionWarning] = useState(false);

  // Skip shell on login page
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email);
      }
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft > 0 && msLeft < 5 * 60 * 1000) {
          setSessionWarning(true);
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/admin/login");
      } else if (event === "TOKEN_REFRESHED") {
        setSessionWarning(false);
      }
    });

    // Periodic check every 60s to auto-refresh token before expiry
    const intervalId = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.expires_at) {
        const msLeft = data.session.expires_at * 1000 - Date.now();
        if (msLeft < 10 * 60 * 1000) {
          const { error } = await supabase.auth.refreshSession();
          if (error) setSessionWarning(true);
        }
      }
    }, 60000);

    return () => {
      listener.subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const currentNav = NAV_ITEMS.find((i) => pathname.startsWith(i.href));
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "A";

  return (
    <div className="min-h-screen flex bg-[#f5f4ff]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Dark Indigo Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-indigo-900/60 bg-indigo-950 text-indigo-100 transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-indigo-900/60 px-4 py-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-950/50">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-white">
                KTX HANU
              </p>
              <p className="text-[11px] font-medium text-indigo-300">
                Quản trị nội trú
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-indigo-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "border-l-2 border-indigo-400 bg-white/12 text-white font-semibold shadow-sm"
                    : "text-indigo-200/80 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-indigo-300" : "text-indigo-400/80"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-indigo-900/60 p-3.5 space-y-2.5">
          {userEmail && (
            <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-indigo-300">
                  Quản trị viên
                </p>
                <p
                  className="truncate text-xs font-semibold text-white"
                  title={userEmail}
                >
                  {userEmail}
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-indigo-100/80 bg-white/85 px-4 py-3.5 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
              <span className="hidden font-medium sm:inline">Admin</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-bold text-slate-900">
                {currentNav?.label ?? "Hệ thống Quản trị Ký túc xá"}
              </span>
            </div>
          </div>

          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 sm:text-sm"
          >
            Xem Cổng Sinh viên
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </header>

        {sessionWarning && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Phiên đăng nhập sắp hết hạn. Vui lòng lưu công việc đang thực hiện.
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
